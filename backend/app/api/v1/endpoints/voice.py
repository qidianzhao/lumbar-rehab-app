"""讯飞 TTS / ASR 接口封装。"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import wave
import io
from datetime import datetime, timezone
from urllib.parse import urlencode

import websockets
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user

router = APIRouter()


# ── 签名工具 ──────────────────────────────────────────────────────────────────

def _xfyun_auth_url(host: str, path: str, api_key: str, api_secret: str) -> str:
    now = datetime.now(timezone.utc)
    date = now.strftime("%a, %d %b %Y %H:%M:%S GMT")
    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
    signature = base64.b64encode(
        hmac.new(api_secret.encode(), signature_origin.encode(), hashlib.sha256).digest()
    ).decode()
    auth = base64.b64encode(
        f'api_key="{api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'.encode()
    ).decode()
    params = urlencode({"authorization": auth, "date": date, "host": host})
    return f"wss://{host}{path}?{params}"


# ── TTS ───────────────────────────────────────────────────────────────────────

class TtsRequest(BaseModel):
    text: str


async def _xfyun_tts(text: str) -> bytes:
    app_id = settings.XFYUN_APP_ID or ""
    api_key = settings.XFYUN_API_KEY or ""
    api_secret = settings.XFYUN_API_SECRET or ""

    host = "tts-api.xfyun.cn"
    path = "/v2/tts"
    url = _xfyun_auth_url(host, path, api_key, api_secret)

    payload = {
        "common": {"app_id": app_id},
        "business": {
            "aue": "lame",       # MP3
            "auf": "audio/L16;rate=16000",
            "vcn": "xiaoyan",
            "speed": 50,
            "volume": 80,
            "pitch": 50,
            "tte": "UTF8",
        },
        "data": {
            "status": 2,
            "text": base64.b64encode(text.encode("utf-8")).decode(),
        },
    }

    audio_chunks: list[bytes] = []
    async with websockets.connect(url) as ws:
        await ws.send(json.dumps(payload))
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            data = json.loads(msg)
            code = data.get("code", -1)
            if code != 0:
                raise RuntimeError(f"讯飞TTS错误 code={code}: {data.get('message')}")
            audio_b64 = data.get("data", {}).get("audio", "")
            if audio_b64:
                audio_chunks.append(base64.b64decode(audio_b64))
            if data.get("data", {}).get("status") == 2:
                break

    return b"".join(audio_chunks)


@router.post("/tts")
async def tts(
    body: TtsRequest,
    _current_user: dict = Depends(get_current_user),
) -> Response:
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text 不能为空")
    if len(body.text) > 500:
        raise HTTPException(status_code=400, detail="text 不能超过500字")
    try:
        audio = await _xfyun_tts(body.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS服务异常: {e}") from e
    return Response(content=audio, media_type="audio/mpeg")


# ── ASR ───────────────────────────────────────────────────────────────────────

async def _xfyun_asr(pcm_data: bytes) -> str:
    app_id = settings.XFYUN_APP_ID or ""
    api_key = settings.XFYUN_API_KEY or ""
    api_secret = settings.XFYUN_API_SECRET or ""

    host = "iat-api.xfyun.cn"
    path = "/v2/iat"
    url = _xfyun_auth_url(host, path, api_key, api_secret)

    CHUNK = 1280  # 40ms @ 16kHz 16bit mono

    result_parts: list[str] = []

    async with websockets.connect(url) as ws:
        # 首帧
        first_frame = {
            "common": {"app_id": app_id},
            "business": {
                "language": "zh_cn",
                "domain": "iat",
                "accent": "mandarin",
                "vad_eos": 3000,
                "dwa": "wpgs",
            },
            "data": {
                "status": 0,
                "format": "audio/L16;rate=16000",
                "encoding": "raw",
                "audio": base64.b64encode(pcm_data[:CHUNK]).decode(),
            },
        }
        await ws.send(json.dumps(first_frame))

        # 中间帧
        offset = CHUNK
        while offset < len(pcm_data):
            chunk = pcm_data[offset: offset + CHUNK]
            await ws.send(json.dumps({
                "data": {
                    "status": 1,
                    "format": "audio/L16;rate=16000",
                    "encoding": "raw",
                    "audio": base64.b64encode(chunk).decode(),
                }
            }))
            offset += CHUNK
            await asyncio.sleep(0.04)

        # 末帧
        await ws.send(json.dumps({
            "data": {"status": 2, "format": "audio/L16;rate=16000", "encoding": "raw", "audio": ""}
        }))

        # 接收结果
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            data = json.loads(msg)
            code = data.get("code", -1)
            if code != 0:
                raise RuntimeError(f"讯飞ASR错误 code={code}: {data.get('message')}")
            ws_data = data.get("data", {})
            result = ws_data.get("result", {})
            ws_text = result.get("ws", [])
            for w in ws_text:
                for cw in w.get("cw", []):
                    result_parts.append(cw.get("w", ""))
            if ws_data.get("status") == 2:
                break

    return "".join(result_parts)


@router.post("/asr", response_model=dict)
async def asr(
    audio: UploadFile = File(...),
    _current_user: dict = Depends(get_current_user),
) -> dict:
    raw = await audio.read()
    if not raw:
        raise HTTPException(status_code=400, detail="音频文件为空")

    filename = audio.filename or ""
    content_type = audio.content_type or ""
    print(f"ASR 收到文件: {filename}, content_type={content_type}, size={len(raw)}")

    # 提取 PCM：WAV 取 data chunk，其他格式用 ffmpeg 转换
    pcm = _extract_pcm(raw, filename)
    print(f"PCM 数据大小: {len(pcm)}")

    try:
        text = await _xfyun_asr(pcm)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ASR服务异常: {e}") from e

    return {"code": 0, "message": "ok", "data": {"text": text}}


def _extract_pcm(raw: bytes, filename: str) -> bytes:
    # WAV 直接解包
    if raw[:4] == b"RIFF":
        try:
            with wave.open(io.BytesIO(raw)) as wf:
                print(f"WAV: {wf.getnchannels()}ch {wf.getframerate()}Hz {wf.getsampwidth()*8}bit")
                # 如果不是 16kHz 单声道，用 ffmpeg 重采样
                if wf.getframerate() != 16000 or wf.getnchannels() != 1:
                    return _ffmpeg_to_pcm16k(raw)
                return wf.readframes(wf.getnframes())
        except Exception as e:
            print(f"WAV 解析失败: {e}")

    # 非 WAV（m4a/aac/mp4/caf）→ ffmpeg 转换
    return _ffmpeg_to_pcm16k(raw)


def _ffmpeg_to_pcm16k(raw: bytes) -> bytes:
    import subprocess, tempfile, os
    with tempfile.NamedTemporaryFile(suffix='.audio', delete=False) as f:
        f.write(raw)
        in_path = f.name
    out_path = in_path + '.pcm'
    try:
        result = subprocess.run(
            ['ffmpeg', '-y', '-i', in_path,
             '-ar', '16000', '-ac', '1', '-f', 's16le', out_path],
            capture_output=True, timeout=30
        )
        if result.returncode != 0:
            print(f"ffmpeg 错误: {result.stderr.decode()}")
            return raw  # 降级：直接发原始数据
        with open(out_path, 'rb') as f:
            return f.read()
    except FileNotFoundError:
        print("ffmpeg 未安装，直接发送原始音频")
        return raw
    finally:
        os.unlink(in_path)
        if os.path.exists(out_path):
            os.unlink(out_path)

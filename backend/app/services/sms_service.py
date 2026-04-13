import random


def generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def send_sms(phone: str, code: str) -> bool:
    print(f"[验证码] {code} 已发送到 {phone}")
    return True

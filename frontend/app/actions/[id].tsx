import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { VideoView, useVideoPlayer } from 'expo-video'

const API = 'http://192.168.5.119:8000/api/v1'

const PHASE_LABEL: Record<string, string> = {
  warmup: '热身',
  core: '核心',
  stretch: '拉伸',
}

type Action = {
  id: number
  name: string
  phase: string
  difficulty_level: number
  description: string | null
  video_url: string | null
}

export default function ActionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [action, setAction] = useState<Action | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/actions/${id}`)
      .then(r => r.json())
      .then(setAction)
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }, [id])

  const player = useVideoPlayer(action?.video_url ?? null, p => {
    p.loop = true
  })

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>
  if (error || !action) return <View style={styles.center}><Text style={styles.error}>{error ?? '动作不存在'}</Text></View>

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {action.video_url ? (
        <VideoView
          player={player}
          style={styles.video}
          allowsFullscreen
          allowsPictureInPicture
        />
      ) : (
        <View style={styles.noVideo}>
          <Text style={styles.noVideoText}>暂无视频</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{action.name}</Text>
        <Text style={styles.meta}>
          {PHASE_LABEL[action.phase] ?? action.phase} · 难度 {action.difficulty_level}
        </Text>
        {action.description ? (
          <Text style={styles.desc}>{action.description}</Text>
        ) : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: 'red' },
  container: { flexGrow: 1, backgroundColor: '#fff' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  noVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: { color: '#aaa', fontSize: 14 },
  info: { padding: 20 },
  name: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  meta: { fontSize: 14, color: '#888', marginTop: 6 },
  desc: { fontSize: 15, color: '#444', marginTop: 12, lineHeight: 22 },
})

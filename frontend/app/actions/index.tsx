import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'

const API = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000/api/v1'

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

export default function ActionsListScreen() {
  const router = useRouter()
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/actions`)
      .then(r => r.json())
      .then(setActions)
      .catch(() => setError('加载失败，请检查网络'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>

  return (
    <FlatList
      data={actions}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push(`/actions/${item.id}`)}>
          <View style={styles.cardLeft}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {PHASE_LABEL[item.phase] ?? item.phase} · 难度 {item.difficulty_level}
            </Text>
          </View>
          <View style={[styles.badge, item.video_url ? styles.badgeGreen : styles.badgeGray]}>
            <Text style={styles.badgeText}>{item.video_url ? '有视频' : '无视频'}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: 'red' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  meta: { fontSize: 13, color: '#888', marginTop: 3 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGreen: { backgroundColor: '#e6f4ea' },
  badgeGray: { backgroundColor: '#f0f0f0' },
  badgeText: { fontSize: 12, color: '#555' },
})

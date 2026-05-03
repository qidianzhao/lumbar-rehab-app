import axios from 'axios';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendCode } from '@/src/api/auth';
import { useAuthStore } from '@/src/stores/authStore';

function formatApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { detail?: string | { msg?: string }[] } | undefined;
    if (typeof d?.detail === 'string') {
      return d.detail;
    }
    if (Array.isArray(d?.detail)) {
      return d.detail.map((x) => JSON.stringify(x)).join('\n');
    }
    return err.message || '网络错误';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return '请求失败';
}

export default function RegisterScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const onSendCode = useCallback(async () => {
    const p = phone.trim();
    if (!/^\d{11}$/.test(p)) {
      Alert.alert('提示', '请输入11位手机号');
      return;
    }
    if (countdown > 0 || sending) {
      return;
    }
    setSending(true);
    try {
      await sendCode(p);
      setCountdown(60);
    } catch (e) {
      Alert.alert('发送失败', formatApiError(e));
    } finally {
      setSending(false);
    }
  }, [phone, countdown, sending]);

  const onRegister = useCallback(async () => {
    const p = phone.trim();
    const c = code.trim();
    if (!/^\d{11}$/.test(p)) {
      Alert.alert('提示', '请输入11位手机号');
      return;
    }
    if (!/^\d{6}$/.test(c)) {
      Alert.alert('提示', '请输入6位验证码');
      return;
    }
    try {
      await login(p, c);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('注册失败', formatApiError(e));
    }
  }, [phone, code, login]);

  const sendDisabled = sending || countdown > 0 || !/^\d{11}$/.test(phone.trim());

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.card}>
          <Text style={styles.title}>注册</Text>
          <Text style={styles.subtitle}>首次使用请注册账号</Text>
          <Text style={styles.label}>手机号</Text>
          <TextInput
            style={styles.input}
            placeholder="11位手机号"
            keyboardType="number-pad"
            maxLength={11}
            value={phone}
            onChangeText={setPhone}
            editable={!isLoading}
          />
          <Text style={styles.label}>验证码</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="6位验证码"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!isLoading}
            />
            <Pressable
              style={[styles.sendBtn, sendDisabled && styles.sendBtnDisabled]}
              onPress={onSendCode}
              disabled={sendDisabled}>
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Text>
              )}
            </Pressable>
          </View>
          <Pressable
            style={[styles.registerBtn, isLoading && styles.registerBtnDisabled]}
            onPress={onRegister}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerBtnText}>注册</Text>
            )}
          </Pressable>
          <Pressable style={styles.switchLink} onPress={() => router.push('/login')}>
            <Text style={styles.switchText}>已有账号？去登录</Text>
          </Pressable>
        </View>
        <Pressable style={styles.footerLink} onPress={() => router.push('/disclaimer')}>
          <Text style={styles.footerText}>免责声明</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  flex: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, color: '#666', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  codeInput: { flex: 1, marginBottom: 0, marginRight: 10 },
  sendBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#93c5fd' },
  sendBtnText: { color: '#fff', fontWeight: '600' },
  registerBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  registerBtnDisabled: { opacity: 0.7 },
  registerBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchLink: { marginTop: 16, alignItems: 'center' },
  switchText: { color: '#2563eb', fontSize: 14 },
  footerLink: { marginTop: 24, alignItems: 'center' },
  footerText: { color: '#2563eb', fontSize: 14 },
});

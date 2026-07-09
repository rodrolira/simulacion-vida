import { useEffect, useRef, useCallback } from 'react'

export function useWebSocket (url, onMessage) {
  const wsRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    const connect = () => {
      // Usar la misma URL base que la página (el proxy de Vite lo redirige)
      const location = globalThis.location
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${location.host}/ws`

      console.log('Conectando a:', wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ WebSocket conectado')
      }

      ws.onmessage = event => {
        const data = JSON.parse(event.data)
        onMessageRef.current(data)
      }

      ws.onerror = error => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = event => {
        console.log('WebSocket cerrado, reconectando en 2s...')
        setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const send = useCallback(data => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}

import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export function useResource(path) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api(path, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setData(value)
    }).catch(error => {
      if (error.name !== 'AbortError' && !controller.signal.aborted) setError(error.message)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [path, version])
  return { data, loading, error, reload }
}

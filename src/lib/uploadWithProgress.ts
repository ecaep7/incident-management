// Gui file len server bang XMLHttpRequest de theo doi duoc tien do upload.
export function uploadWithProgress(
  url: string,
  formData: FormData,
  token: string | undefined,
  onProgress: (percent: number, loaded: number, total: number) => void,
): Promise<{ ok: boolean; status: number; json: any }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total)
    }

    xhr.onload = () => {
      let json: any = {}
      try { json = JSON.parse(xhr.responseText) } catch {}
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json })
    }
    xhr.onerror = () => resolve({ ok: false, status: 0, json: { message: 'Mất kết nối mạng khi tải file' } })

    xhr.send(formData)
  })
}
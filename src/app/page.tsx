import { redirect } from 'next/navigation'

// Trang goc chua co noi dung rieng -> chuyen thang vao Dashboard
export default function Home() {
  redirect('/dashboard')
}

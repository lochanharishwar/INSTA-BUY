"use client"
import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import RecipeInput from './components/RecipeInput'
import PipelineProgress from './components/PipelineProgress'
import CartReview from './components/CartReview'
import TrackingView from './components/TrackingView'
import GuestView from './components/GuestView'

export default function Home() {
  const { session_id, screen, setSessionId } = useStore()
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
  const [guestUserId, setGuestUserId] = useState<string | null>(null)

  useEffect(() => {
    let sid = localStorage.getItem('session_id')
    if (!sid) {
      sid = crypto.randomUUID()
      localStorage.setItem('session_id', sid)
    }
    setSessionId(sid)
  }, [setSessionId])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinId = urlParams.get('join');
    const user = urlParams.get('user');
    
    if (joinId && user) {
      setGuestSessionId(joinId);
      setGuestUserId(user);
      return;
    }

    if (!session_id) return;
    
    if (urlParams.get('mock_auth') === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [session_id])

  if (guestSessionId && guestUserId) {
    return <GuestView sessionId={guestSessionId} userId={guestUserId} />
  }

  if (!session_id) return <div>Loading...</div>

  return (
    <div>
      {screen === 'input' && <RecipeInput />}
      {screen === 'progress' && <PipelineProgress />}
      {screen === 'review' && <CartReview />}
      {screen === 'tracking' && <TrackingView />}
    </div>
  )
}

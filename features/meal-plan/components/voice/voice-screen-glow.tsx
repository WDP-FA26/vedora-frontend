export function VoiceScreenGlow({ active }: { active: boolean }) {
  return (
    <div aria-hidden data-active={active} className="voice-ai-screen-glow">
      <div className="voice-ai-screen-glow-edge">
        <div className="voice-ai-screen-glow-wheel" />
      </div>
      <div className="voice-ai-screen-glow-aura">
        <div className="voice-ai-screen-glow-wheel" />
      </div>
    </div>
  )
}

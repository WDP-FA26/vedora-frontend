/**
 * The rainbow aura around the whole screen while the voice agent works on the planner.
 * Always mounted during a call so it can fade in and out; it never takes clicks.
 * Uses GPU-composited rotation on oversized inner layers rather than animating gradient stops.
 */
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

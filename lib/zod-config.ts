import { z } from "zod"

/**
 * Zod probes `new Function("")` before its first parse to decide whether it
 * can JIT-compile object schemas. Our CSP has no 'unsafe-eval' in production,
 * so the probe fails (harmlessly) but the browser logs a CSP violation.
 * Jitless mode skips the probe; parsing is otherwise identical.
 */
z.config({ jitless: true })

import { describe, it, expect } from 'vitest'
import { parseYouTubeCaptionXml } from '@/utilities/youtubeTranscripts'

describe('parseYouTubeCaptionXml', () => {
  it('parses timedtext format="3" XML, strips >> markers, decodes entities, and merges short cues', () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<head><ws id="0"/></head>
<body>
<p t="26090" w="1" a="1">
</p>
<p t="26100" d="3000" w="1"><s>&gt;&gt; What</s><s t="300"> triggered</s><s t="800"> a</s><s t="900"> massive</s><s t="1500"> restoration</s></p>
<p t="29100" d="4000" w="1"><s>project</s><s t="400"> at</s><s t="800"> Hagia</s><s t="1200"> Sophia&apos;s</s><s t="1800"> site?</s></p>
<p t="45000" d="4000" w="1"><s>Notice</s><s t="500"> the</s><s t="1000"> bricks</s><s t="1500"> &amp;</s><s t="2000"> mortar.</s></p>
</body>
</timedtext>`

    const parsed = parseYouTubeCaptionXml(xml)
    expect(parsed.segments.length).toBe(2)
    expect(parsed.segments[0]).toEqual({
      startSec: 26,
      endSec: 33,
      text: "What triggered a massive restoration project at Hagia Sophia's site?",
    })
    expect(parsed.segments[1]).toEqual({
      startSec: 45,
      endSec: 49,
      text: 'Notice the bricks & mortar.',
    })
    expect(parsed.wordCount).toBe(15)
    expect(parsed.durationLabel).toBe('00:49')
    expect(parsed.fullText).toContain('[00:26] What triggered a massive restoration')
  })

  it('parses legacy <text start="" dur=""> XML format cleanly', () => {
    const legacy = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="4.2" dur="3.5">&gt;&gt; Welcome back to My Lunch Break.</text>
  <text start="20.0" dur="5.0">Let&#39;s examine the Clearwater Post Office.</text>
</transcript>`

    const parsed = parseYouTubeCaptionXml(legacy)
    expect(parsed.segments).toEqual([
      { startSec: 4, endSec: 7, text: 'Welcome back to My Lunch Break.' },
      { startSec: 20, endSec: 25, text: "Let's examine the Clearwater Post Office." },
    ])
    expect(parsed.wordCount).toBe(12)
  })

  it('returns empty safely on empty or invalid XML', () => {
    expect(parseYouTubeCaptionXml('')).toEqual({
      segments: [],
      fullText: '',
      wordCount: 0,
      durationLabel: null,
    })
  })
})

/**
 * Business intelligence types for BI reports and dashboards.
 */
export interface BusinessMetric {
  id?: string
  name: string
  value?: unknown
  target?: number
  status?: 'achieved' | 'on_track' | 'at_risk' | string
  unit?: string
}

export interface BusinessInsight {
  id?: string
  title: string
  description?: string
  type?: string
  [key: string]: unknown
}

export interface BusinessRecommendation {
  id?: string
  title: string
  description?: string
  status?: 'suggested' | 'accepted' | 'rejected' | string
  priority?: string
  [key: string]: unknown
}

export interface VisualizationConfig {
  type: string
  options?: Record<string, unknown>
  data?: unknown
  [key: string]: unknown
}

export interface BusinessIntelligenceData {
  reportId?: string
  metrics: BusinessMetric[]
  insights: BusinessInsight[]
  recommendations: BusinessRecommendation[]
  visualizations?: VisualizationConfig[]
  [key: string]: unknown
}

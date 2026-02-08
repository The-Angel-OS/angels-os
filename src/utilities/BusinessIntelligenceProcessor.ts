// Task 004: Business Intelligence Processor
// Handles the processing, analysis, and enrichment of BusinessIntelligenceData
// embedded in or extracted from messages.

import {
  BusinessIntelligenceData,
  BusinessMetric,
  BusinessInsight,
  BusinessRecommendation,
  VisualizationConfig,
} from '../types/business-intelligence';
import { MessageContent } from '../types/messages';

export class BusinessIntelligenceProcessor {
  /**
   * Processes raw BusinessIntelligenceData.
   * This could involve validation, enrichment, generating new insights, or preparing data for display.
   * @param biData The raw BusinessIntelligenceData object.
   * @returns Processed BusinessIntelligenceData, or the original if no processing is done.
   */
  static processData(biData: BusinessIntelligenceData): BusinessIntelligenceData {
    console.log('[BusinessIntelligenceProcessor.processData] Processing BI Data for report:', biData.reportId || 'N/A');

    // Placeholder for actual processing logic.
    // Examples:
    // - Validate metrics against predefined schemas.
    // - Enrich insights with additional context from other sources.
    // - Generate new recommendations based on metrics and insights.
    // - Prepare visualization configurations for rendering.

    const processedMetrics = biData.metrics.map(metric => this.processMetric(metric));
    const processedInsights = biData.insights.map(insight => this.processInsight(insight));
    const processedRecommendations = biData.recommendations.map(rec => this.processRecommendation(rec));
    const processedVisualizations = biData.visualizations?.map(vis => this.processVisualization(vis));

    return {
      ...biData,
      metrics: processedMetrics,
      insights: processedInsights,
      recommendations: processedRecommendations,
      visualizations: processedVisualizations,
      // Potentially add a 'lastProcessed' timestamp
    };
  }

  /**
   * Processes an individual business metric.
   * @param metric The BusinessMetric object.
   * @returns The processed BusinessMetric object.
   */
  static processMetric(metric: BusinessMetric): BusinessMetric {
    // Example: Calculate status based on value vs target
    let status = metric.status;
    if (metric.target !== undefined && metric.value !== undefined) {
      const numericValue = Number(metric.value);
      if (!isNaN(numericValue) && metric.target) {
         if (numericValue >= metric.target) status = 'achieved'; // Simplified logic
         else if (numericValue >= metric.target * 0.8) status = 'on_track';
         else status = 'at_risk';
      }
    }
    return { ...metric, status: status || metric.status };
  }

  /**
   * Processes an individual business insight.
   * @param insight The BusinessInsight object.
   * @returns The processed BusinessInsight object.
   */
  static processInsight(insight: BusinessInsight): BusinessInsight {
    // Process the insight - could add validation, enrichment, etc.
    return { ...insight };
  }

  /**
   * Processes an individual business recommendation.
   * @param recommendation The BusinessRecommendation object.
   * @returns The processed BusinessRecommendation object.
   */
  static processRecommendation(recommendation: BusinessRecommendation): BusinessRecommendation {
    // Example: Set a default status if not present
    return { ...recommendation, status: recommendation.status || 'suggested' };
  }

    /**
   * Processes an individual visualization configuration.
   * @param vizConfig The VisualizationConfig object.
   * @returns The processed VisualizationConfig object.
   */
  static processVisualization(vizConfig: VisualizationConfig): VisualizationConfig {
    // Example: Ensure some default options if missing
    const defaultOptions = { responsive: true, maintainAspectRatio: false };
    return { ...vizConfig, options: { ...defaultOptions, ...vizConfig.options } };
  }

  /**
   * Extracts relevant BusinessIntelligenceData from a generic MessageContent object.
   * This might look for BI data directly, or infer it from other parts of the message.
   * @param messageContent The content of the message.
   * @returns BusinessIntelligenceData if found and processed, otherwise null.
   */
  static extractAndProcessFromMessage(messageContent: MessageContent): BusinessIntelligenceData | null {
    console.log('[BusinessIntelligenceProcessor.extractAndProcessFromMessage] Attempting to extract BI from message type:', messageContent.type);
    if (messageContent.type === 'intelligence' && messageContent.intelligenceData) {
      return this.processData(messageContent.intelligenceData);
    }
    // Potentially look for BI data in widgets or structured text in the future.
    // e.g., if a widget of type 'kpi_dashboard' has BI data in its content.
    if (messageContent.widgets) {
        for (const widget of messageContent.widgets) {
            // Hypothetical: if widget.content has a biPayload field
            // if (widget.type === 'bi_display' && widget.content?.biPayload) {
            //    return this.processData(widget.content.biPayload as BusinessIntelligenceData);
            // }
        }
    }

    console.log('[BusinessIntelligenceProcessor.extractAndProcessFromMessage] No direct BI data found or extracted.');
    return null;
  }

  // TODO: Add more methods for:
  // - Generating insights from raw data (if this system is responsible for that)
  // - Tracking effectiveness of recommendations
  // - Integrating with external BI platforms or databases
}

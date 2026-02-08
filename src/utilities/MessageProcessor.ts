// Task 004: Message Processing Utilities
// Provides utilities for handling enhanced message content, including validation,
// BI data extraction, conversation context generation, and widget processing.

import {
  MessageContent,
  DynamicWidget,
  // Assuming ProcessedWidget would be a type defined perhaps based on DynamicWidget
  // but with additional processed state or data. For now, using DynamicWidget.
} from '../types/messages';
import { ConversationContext } from '../types/conversation';
import { BusinessIntelligenceData } from '../types/business-intelligence';

// Define a placeholder for ProcessedWidget if it's different from DynamicWidget
// For now, let's assume it might have some additional runtime properties.
export interface ProcessedWidget extends DynamicWidget {
  isValidated: boolean;
  // other processed properties
}

export class MessageProcessor {
  /**
   * Validates the structure and content of a message.
   * - Checks against JSON schema for MessageContent.
   * - Validates widget configurations and compatibility.
   * - Verifies business intelligence data integrity.
   * @param content The MessageContent object to validate.
   * @returns True if valid, false otherwise.
   * @throws Error if validation fails with specific details.
   */
  static validateContent(content: MessageContent): boolean {
    console.log('[MessageProcessor.validateContent] Validating message content:', content.type);
    // TODO: Implement actual validation logic.
    // Example checks:
    if (!content.type) {
      throw new Error('Message content must have a type.');
    }
    switch (content.type) {
      case 'text':
        if (typeof content.text !== 'string' || content.text.trim() === '') {
          // throw new Error('Text message content cannot be empty.');
          console.warn('Text message content is empty or not a string.');
        }
        break;
      case 'widget':
        if (!content.widgets || content.widgets.length === 0) {
          throw new Error('Widget message must contain at least one widget.');
        }
        content.widgets.forEach(widget => {
          if (!widget.widgetId || !widget.type || !widget.title) {
            throw new Error(`Widget ${widget.widgetId} is missing required fields (widgetId, type, title).`);
          }
          // Further validation for widget.content based on widget.type
        });
        break;
      // Add cases for 'system', 'action', 'intelligence'
    }
    // Placeholder validation for metadata if present
    if (content.metadata && !content.metadata.conversationId) {
        // throw new Error('Message metadata must include a conversationId.');
        console.warn('Message metadata is missing conversationId.');
    }

    console.log('[MessageProcessor.validateContent] Validation placeholder complete.');
    return true; // Placeholder
  }

  /**
   * Extracts and processes Business Intelligence data from message content.
   * @param content The MessageContent object.
   * @returns Processed BusinessIntelligenceData or null if not present/applicable.
   */
  static extractBusinessIntelligence(content: MessageContent): BusinessIntelligenceData | null {
    console.log('[MessageProcessor.extractBusinessIntelligence] Extracting BI data from type:', content.type);
    if (content.type === 'intelligence' && content.intelligenceData) {
      // TODO: Implement actual BI data processing (e.g., parsing, enrichment).
      console.log('[MessageProcessor.extractBusinessIntelligence] BI data found:', content.intelligenceData);
      return content.intelligenceData; // Placeholder
    }
    if (content.widgets) {
        // Potentially extract BI data from widgets too
    }
    console.log('[MessageProcessor.extractBusinessIntelligence] No direct BI data found.');
    return null;
  }

  /**
   * Generates or updates conversation context based on the current message.
   * - Analyzes message intent (placeholder for actual NLU).
   * - Updates conversation phase, history, and memory.
   * - Tracks business goals.
   * @param messageContent The content of the current message.
   * @param previousContext Optional existing ConversationContext to update.
   * @returns The new or updated ConversationContext.
   */
  static generateConversationContext(
    messageContent: MessageContent,
    previousContext?: ConversationContext
  ): ConversationContext {
    console.log('[MessageProcessor.generateConversationContext] Generating context for message type:', messageContent.type);
    // TODO: Implement actual context generation logic (NLU, state machine, etc.).

    const conversationId = messageContent.metadata?.conversationId || previousContext?.conversationId || `conv_${Date.now()}`;

    let newContext: ConversationContext = {
      ...(previousContext || {
        conversationId: conversationId,
        phase: 'discovery', // Default phase
        intentHistory: [],
        activeBusinessGoals: [],
        userPreferences: {},
        sessionMemory: {},
      }),
      conversationId: conversationId, // Ensure conversationId is set
      lastUserMessageTimestamp: new Date(), // Assuming this is a user message for now
    };

    if (messageContent.metadata?.intent) {
      newContext.currentPrimaryIntent = messageContent.metadata.intent.name;
      newContext.intentHistory = [...(newContext.intentHistory || []), messageContent.metadata.intent];
    } else {
      // Basic intent detection placeholder
      if (messageContent.text?.toLowerCase().includes('help')) {
        newContext.currentPrimaryIntent = 'request_assistance';
      }
    }

    console.log('[MessageProcessor.generateConversationContext] Context generation placeholder complete.');
    return newContext; // Placeholder
  }

  /**
   * Processes dynamic widgets within a message.
   * - Validates widget configurations.
   * - Applies business context and ethical constraints.
   * @param widgets An array of DynamicWidget objects.
   * @returns An array of ProcessedWidget objects.
   */
  static processWidgets(widgets: DynamicWidget[]): ProcessedWidget[] {
    console.log('[MessageProcessor.processWidgets] Processing widgets:', widgets.length);
    // TODO: Implement actual widget processing logic.
    return widgets.map(widget => ({
      ...widget,
      isValidated: true, // Placeholder
      // Apply business context transformations or ethical checks here
    }));
  }
}

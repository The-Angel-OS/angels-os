export class TokenOptimizer {
  private tokenLimit = 150
  private currentUsage = 0

  async checkUsage(estimatedTokens: number): Promise<boolean> {
    if (this.currentUsage + estimatedTokens > this.tokenLimit) {
      console.log(`[TokenOptimizer] Approaching limit: ${this.currentUsage}/${this.tokenLimit}`)
      return false
    }
    this.currentUsage += estimatedTokens
    return true
  }

  resetMonthly() {
    this.currentUsage = 0
  }
}

export const tokenOptimizer = new TokenOptimizer() 
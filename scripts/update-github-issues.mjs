#!/usr/bin/env node

/**
 * Update GitHub Issues with proper descriptions
 * The initial creation didn't properly set the body content
 */

import fs from 'fs'
import { execSync } from 'child_process'

const REPO = 'The-Angel-OS/angels-os'

// Read the original issue data from create-github-issues.mjs
const scriptContent = fs.readFileSync('./scripts/create-github-issues.mjs', 'utf-8')

// Extract issues array (this is a bit hacky but works)
const issuesMatch = scriptContent.match(/const issues = \[([\s\S]*?)\n\]/m)
if (!issuesMatch) {
  console.error('Could not find issues array in script')
  process.exit(1)
}

// Parse the issues (we'll use eval in a controlled way)
const issuesArrayText = 'const issues = [' + issuesMatch[1] + '\n]; issues'
const issues = eval(issuesArrayText)

console.log(`🦅 Updating ${issues.length} GitHub issues with proper descriptions\n`)

// Skip first issue (it's a duplicate), update #3-22
issues.slice(1).forEach((issue, index) => {
  const issueNumber = index + 3 // Start at #3
  const tempFile = `.github-issues/temp-issue-${issueNumber}.md`
  
  console.log(`[${issueNumber}] Updating: ${issue.title}`)
  
  // Write body to temp file
  fs.writeFileSync(tempFile, issue.body.trim())
  
  try {
    // Update the issue
    execSync(`gh issue edit ${issueNumber} --repo ${REPO} --body-file "${tempFile}"`, {
      stdio: 'pipe'
    })
    console.log(`✅ Updated issue #${issueNumber}`)
    
    // Clean up temp file
    fs.unlinkSync(tempFile)
    
    // Rate limiting
    if (index < issues.length - 2) {
      const start = Date.now()
      while (Date.now() - start < 1000) {
        // Wait 1 second
      }
    }
  } catch (error) {
    console.error(`❌ Failed to update issue #${issueNumber}:`, error.message)
  }
})

console.log('\n✅ All issues updated!')
console.log(`View them at: https://github.com/${REPO}/issues`)

#!/usr/bin/env node

/**
 * Extract issue content from GITHUB_ISSUES_MVP.md and update GitHub issues
 */

import fs from 'fs'
import { execSync } from 'child_process'

const REPO = 'The-Angel-OS/angels-os'
const MVP_DOC = './docs/GITHUB_ISSUES_MVP.md'

// Read the MVP document
const content = fs.readFileSync(MVP_DOC, 'utf-8')

// Split by issue headers
const issuePattern = /### Issue #(\d+):(.*?)\n\n\*\*Title:\*\*(.*?)\n\n\*\*Labels:\*\*(.*?)\n\n\*\*Description:\*\*([\s\S]*?)(?=\n---\n|$)/g

const issues = []
let match

while ((match = issuePattern.exec(content)) !== null) {
  const [, number, , title, labels, description] = match
  issues.push({
    number: parseInt(number),
    title: title.trim(),
    labels: labels.trim(),
    body: description.trim()
  })
}

console.log(`🦅 Found ${issues.length} issues in ${MVP_DOC}\n`)

// Update issues #3-35 (skip #1 and #2 which have content)
const issuesToUpdate = issues.filter(i => i.number >= 3 && i.number <= 35)

console.log(`Updating ${issuesToUpdate.length} issues (#3-#35)...\n`)

issuesToUpdate.forEach((issue, index) => {
  const tempFile = `.github-issues/temp-${issue.number}.md`
  
  console.log(`[${issue.number}/${issues.length}] ${issue.title}`)
  
  // Write body to temp file
  fs.mkdirSync('.github-issues', { recursive: true })
  fs.writeFileSync(tempFile, issue.body)
  
  try {
    // Update the issue
    execSync(`gh issue edit ${issue.number} --repo ${REPO} --body-file "${tempFile}"`, {
      stdio: 'pipe'
    })
    console.log(`   ✅ Updated`)
    
    // Clean up
    fs.unlinkSync(tempFile)
    
    // Rate limiting
    if (index < issuesToUpdate.length - 1) {
      const start = Date.now()
      while (Date.now() - start < 1000) {
        // Wait 1 second
      }
    }
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`)
  }
})

console.log('\n✅ All issues updated!')
console.log(`View them at: https://github.com/${REPO}/issues`)

#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const DRY_RUN = false // Set to true to test without creating issues
const REPO = 'The-Angel-OS/angels-os'

// Parse GITHUB_ISSUES_MVP.md to extract issues
const issuesFile = './docs/GITHUB_ISSUES_MVP.md'
const content = fs.readFileSync(issuesFile, 'utf-8')

// Split by "### Issue #" to get each issue
const issueBlocks = content.split(/### Issue #(\d+):/).slice(1)

const allIssues = []
for (let i = 0; i < issueBlocks.length; i += 2) {
  const issueNumber = parseInt(issueBlocks[i])
  const issueContent = issueBlocks[i + 1]

  // Extract title (first line after issue number)
  const titleMatch = issueContent.match(/^(.+?)$/m)
  const title = titleMatch ? titleMatch[1].trim() : `Issue ${issueNumber}`

  // Use standard GitHub label only (custom labels don't exist yet)
  const labels = 'enhancement'

  // Extract body (everything after "**Description:**")
  const bodyMatch = issueContent.match(/\*\*Description:\*\*\s*([\s\S]+?)(?=\n---|\n### Issue #|$)/m)
  const body = bodyMatch ? bodyMatch[1].trim() : issueContent.trim()

  allIssues.push({ number: issueNumber, title, labels, body })
}

console.log(`🦅 Found ${allIssues.length} issues in ${issuesFile}\n`)

// Filter to only issues #23-35
const newIssues = allIssues.filter((issue) => issue.number >= 23 && issue.number <= 35)

console.log(`Creating ${newIssues.length} new issues (#23-#35)...\n`)

// Create each issue
for (const issue of newIssues) {
  console.log(`[${issue.number}/35] ${issue.title}`)

  if (DRY_RUN) {
    console.log(`   🔍 DRY RUN - would create issue with labels: ${issue.labels}`)
    continue
  }

  try {
    // Write body to temp file
    const tempFile = `.github-issues/issue-${issue.number}.md`
    fs.mkdirSync('.github-issues', { recursive: true })
    fs.writeFileSync(tempFile, issue.body)

    // Create issue using gh CLI
    const result = execSync(
      `gh issue create --repo ${REPO} --title "${issue.title}" --label "${issue.labels}" --body-file "${tempFile}"`,
      { encoding: 'utf-8' }
    )

    console.log(`   ✅ Created: ${result.trim()}`)

    // Clean up temp file
    fs.unlinkSync(tempFile)

    // Rate limit: wait 1 second between issues
    const start = Date.now()
    while (Date.now() - start < 1000) {
      // Busy wait
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
  }
}

console.log(`\n✅ All new issues created!`)
console.log(`View them at: https://github.com/${REPO}/issues`)

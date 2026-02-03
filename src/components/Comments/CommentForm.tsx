'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star } from 'lucide-react'

type CommentFormProps = {
  parentId: number
  parentCollection: 'posts' | 'products'
  showRating?: boolean
}

export function CommentForm({ parentId, parentCollection, showRating }: CommentFormProps) {
  const [author, setAuthor] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/comments/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId,
          parentCollection,
          author: author.trim(),
          email: email.trim(),
          content: content.trim(),
          ...(showRating && rating != null && { rating }),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || 'Failed to submit comment')
      }

      setStatus('success')
      setAuthor('')
      setEmail('')
      setContent('')
      setRating(null)
      window.location.reload()
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (status === 'success') {
    return (
      <p className="text-sm text-muted-foreground">
        Thank you! Your comment has been submitted and is awaiting moderation.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="comment-author">Name *</Label>
          <Input
            id="comment-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
            disabled={status === 'submitting'}
            placeholder="Your name"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="comment-email">Email *</Label>
          <Input
            id="comment-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === 'submitting'}
            placeholder="your@email.com"
            className="mt-1"
          />
        </div>
      </div>

      {showRating && (
        <div>
          <Label>Rating</Label>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="rounded p-1 transition-colors hover:bg-muted"
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                <Star
                  className={`h-6 w-6 ${
                    rating != null && star <= rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="comment-content">Comment *</Label>
        <Textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          disabled={status === 'submitting'}
          placeholder="Write your comment..."
          rows={4}
          className="mt-1"
        />
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Submitting...' : 'Submit Comment'}
      </Button>
    </form>
  )
}

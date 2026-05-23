import Link from 'next/link'
import type { PostMeta } from '@/types/post'

interface PostCardProps {
  post: PostMeta
  variant?: 'home' | 'blog'
}

export function PostCard({ post, variant = 'home' }: PostCardProps) {
  // MVP: variant pozostawiony jako future hook — wariant 'blog' (Prompt 04) może
  // tweakować density. Aktualnie identyczny render dla obu wariantów.
  void variant

  return (
    <article className="group h-full rounded-lg border border-border bg-bg-secondary p-6 hover:border-burgundy transition-colors">
      <Link
        href={`/posts/${post.slug}/`}
        aria-label={`Read post: ${post.title}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy rounded"
      >
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h3 className="font-display text-2xl text-text-primary group-hover:text-burgundy transition-colors">
            {post.title}
          </h3>
          <time dateTime={post.date} className="text-text-tertiary text-sm font-sans shrink-0">
            {post.dateDisplay}
          </time>
        </div>
        <p className="text-text-secondary mb-4 font-sans leading-relaxed line-clamp-3">
          {post.summary}
        </p>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="post-card-tags">
            {post.tags.map(tag => (
              <span
                key={tag}
                data-testid="post-card-tag"
                className="bg-burgundy-soft text-burgundy text-xs px-2 py-0.5 rounded font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
    </article>
  )
}

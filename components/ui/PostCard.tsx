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
    <article className="group h-full rounded-lg border border-border bg-bg-secondary p-5 sm:p-6 hover:border-accent transition-colors">
      <Link
        href={`/posts/${post.slug}/`}
        prefetch={false}
        aria-label={`Read post: ${post.title}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 mb-2">
          <h3 className="font-sans font-semibold text-xl sm:text-2xl text-text-primary group-hover:text-accent transition-colors">
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
                className="bg-accent-soft text-accent text-xs px-3 py-0.5 rounded-full font-sans"
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

import { getAllPosts } from '@/lib/posts'
import { Hero } from '@/components/home/Hero'
import { LatestPosts } from '@/components/home/LatestPosts'

export default async function Home() {
  const posts = await getAllPosts()
  return (
    <>
      <Hero />
      <LatestPosts allPosts={posts} />
    </>
  )
}

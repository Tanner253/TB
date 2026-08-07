import { redirect } from 'next/navigation'

/** Session root — leaderboard is the primary surface for every listing. */
export default function TenantSessionRedirect({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/leaderboard`)
}

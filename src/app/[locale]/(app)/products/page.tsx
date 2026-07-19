import { redirect } from 'next/navigation'

// /products has only [slug] detail pages — the index lives at /shop. Redirect so
// a bare /products (typed, or an old link) lands on the catalog instead of 404ing.
export default function ProductsIndex() {
  redirect('/shop')
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect address
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const isLocalEnv = process.env.NODE_ENV === 'development'
    const forwardedHost = request.headers.get('x-forwarded-host') // Original origin before load balancer
    
    let redirectUrl = `${origin}${next}`
    if (!isLocalEnv && forwardedHost) {
      redirectUrl = `https://${forwardedHost}${next}`
    }

    // 1. Create a response object in advance to hold cookie updates
    const response = NextResponse.redirect(redirectUrl)

    // 2. Create the server client with direct response cookie synchronization
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // 3. Exchange authorization code for session (cookies are written directly to response)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return response
    }
    
    console.error('Auth callback exchange error:', error)
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}


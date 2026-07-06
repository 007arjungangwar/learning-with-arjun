import { create } from 'zustand'
import { supabase, ASG_SUPABASE_CONFIG } from '@/lib/supabaseClient'
import { Profile } from '@/types'

interface AuthState {
  user: any | null
  profile: Profile | null
  loading: boolean
  isInitialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  updatePassword: (password: string) => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  initialize: () => () => void
}

const adminEmails = ASG_SUPABASE_CONFIG.adminEmails.map(email => email.toLowerCase())

const isConfiguredAdminEmail = (email?: string | null) =>
  Boolean(email && adminEmails.includes(email.toLowerCase()))

const profileWithConfiguredRole = (profile: Profile): Profile => {
  if (!isConfiguredAdminEmail(profile.email)) return profile
  return { ...profile, role: 'admin' }
}

const buildProfileForUser = (user: any, fallbackName?: string): Profile => {
  const email = (user.email || '').toLowerCase()
  return {
    id: user.id,
    name: fallbackName?.trim() || user.user_metadata?.name || user.user_metadata?.full_name || email.split('@')[0] || 'Student',
    email,
    role: isConfiguredAdminEmail(email) ? 'admin' : 'student',
    join_date: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

const saveProfile = async (profile: Profile) => {
  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })

  if (error) {
    console.warn('Could not save user profile in DB:', error.message)
  }
}

const syncProfileForUser = async (user: any, fallbackName?: string): Promise<Profile | null> => {
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, join_date, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error

  if (profile) {
    const effectiveProfile = profileWithConfiguredRole(profile as Profile)
    if (effectiveProfile.role !== profile.role) {
      await saveProfile({ ...effectiveProfile, updated_at: new Date().toISOString() })
    }
    return effectiveProfile
  }

  const newProfile = buildProfileForUser(user, fallbackName)
  await saveProfile(newProfile)
  return newProfile
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,

  signIn: async (email, password) => {
    set({ loading: true })
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })
    if (error) {
      set({ loading: false })
      throw error
    }
    // Session state change will trigger the profile fetch via the auth state change listener
  },

  register: async (email, password, name) => {
    set({ loading: true })
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name: name.trim() }
      }
    })
    if (error) {
      set({ loading: false })
      throw error
    }

    if (data.user) {
      await syncProfileForUser({ ...data.user, email: normalizedEmail }, name.trim())
    }
    set({ loading: false })
  },

  signOut: async () => {
    set({ loading: true })
    const { error } = await supabase.auth.signOut()
    if (error) {
      set({ loading: false })
      throw error
    }
    set({ user: null, profile: null, loading: false })
    sessionStorage.removeItem('currentUser')
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },

  resetPasswordForEmail: async (email) => {
    const currentPath = window.location.origin
    const redirectTo = `${currentPath}/login?mode=reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo
    })
    if (error) throw error
  },

  initialize: () => {
    // Initial session load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user || null
      if (user) {
        try {
          const profile = await syncProfileForUser(user)
          if (profile) {
            set({ user, profile, loading: false, isInitialized: true })
            sessionStorage.setItem('currentUser', JSON.stringify(profile))
            return
          }
        } catch (e) {
          console.warn('Could not read user profile:', e)
        }
      }
      set({ user, profile: null, loading: false, isInitialized: true })
    })

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user || null
        if (user) {
          try {
            const profile = await syncProfileForUser(user)
            if (profile) {
              set({ user, profile, loading: false })
              sessionStorage.setItem('currentUser', JSON.stringify(profile))
              return
            }
          } catch (e) {
            console.warn('Error syncing profile:', e)
          }
        }
        set({ user, profile: null, loading: false })
        sessionStorage.removeItem('currentUser')
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }
}))

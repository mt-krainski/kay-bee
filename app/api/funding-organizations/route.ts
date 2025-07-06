import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Check if funding organization with this name already exists
    const { data: existingOrg } = await supabase
      .from('funding_organizations')
      .select('id')
      .eq('name', name)
      .single()

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Funding organization with this name already exists' },
        { status: 409 }
      )
    }

    // Insert new funding organization
    const { data: organization, error } = await supabase
      .from('funding_organizations')
      .insert([
        {
          name,
          description,
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to create funding organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({ organization }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { data: organizations, error } = await supabase
      .from('funding_organizations')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch funding organizations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
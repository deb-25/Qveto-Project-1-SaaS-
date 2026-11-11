import React, { createContext, useContext, useState, useEffect } from 'react';
import { Organization, OrgRole } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../api/supabaseClient';

interface OrgContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  currentRole: OrgRole;
  setCurrentOrg: (org: Organization) => void;
  loading: boolean;
  refreshOrgs: () => Promise<void>;
  createOrganization: (name: string, slug: string) => Promise<Organization | null>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<OrgRole>('employee');
  const [loading, setLoading] = useState(false);

  const refreshOrgs = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrgState(null);
      return;
    }

    try {
      setLoading(true);
      // Fetch organizations the user belongs to from real memberships table
      const { data, error } = await supabase
        .from('memberships')
        .select('role, organizations (*)')
        .eq('user_id', user.id);

      if (!error && data && (data as any[]).length > 0) {
        const orgList = (data as any[])
          .map((item: any) => item.organizations as Organization)
          .filter(Boolean);

        setOrganizations(orgList);
        if (orgList.length > 0) {
          const defaultOrg = orgList[0];
          setCurrentOrgState(defaultOrg);
          const activeMembership = (data as any[]).find((m: any) => m.organizations?.id === defaultOrg.id);
          setCurrentRole((activeMembership?.role as OrgRole) || 'employee');
        }
      } else {
        setOrganizations([]);
        setCurrentOrgState(null);
      }
    } catch {
      setOrganizations([]);
      setCurrentOrgState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOrgs();
  }, [user]);

  const setCurrentOrg = async (org: Organization) => {
    setCurrentOrgState(org);
    if (!user) return;

    // Load active role for the selected organization
    const { data } = await (supabase.from('memberships') as any)
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', org.id)
      .maybeSingle();

    if ((data as any)?.role) {
      setCurrentRole((data as any).role as OrgRole);
    }
  };

  const createOrganization = async (name: string, slug: string): Promise<Organization | null> => {
    if (!user) return null;

    try {
      // Step A: Ensure user profile is registered in public.users so foreign keys don't fail
      try {
        await (supabase.from('users') as any).upsert({
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          avatar_url: user.avatar_url,
          timezone: 'UTC',
        }, { onConflict: 'id' });
      } catch (upsertErr) {
        console.warn('Profile upsert note:', upsertErr);
      }

      // Step B: Pre-generate a client UUID so we know the organization ID without needing .select()
      const orgId = crypto.randomUUID();
      const cleanSlug = (slug.trim().toLowerCase() || name.trim().toLowerCase().replace(/\s+/g, '-')) + '-' + Math.random().toString(36).substring(2, 6);

      // Step C: Try RPC function first if defined in database
      try {
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('create_organization', {
          name: name.trim(),
          slug: cleanSlug,
        });
        if (!rpcErr && rpcData) {
          const org = rpcData as Organization;
          await refreshOrgs();
          setCurrentOrg(org);
          return org;
        }
      } catch {}

      // Step D: Insert into organizations WITHOUT .select()
      // This strictly checks INSERT policy without triggering the SELECT check before membership exists
      let insertError: any = null;
      const { error: orgErr1 } = await (supabase.from('organizations') as any).insert({
        id: orgId,
        name: name.trim(),
        slug: cleanSlug,
        created_by: user.id,
      });

      if (orgErr1) {
        // Fallback retry without created_by if foreign key constraint triggered
        const { error: orgErr2 } = await (supabase.from('organizations') as any).insert({
          id: orgId,
          name: name.trim(),
          slug: cleanSlug,
        });
        if (orgErr2) insertError = orgErr2;
      }

      if (insertError) {
        console.error('Organization insert error:', insertError);
        throw insertError;
      }

      // Step E: Insert Membership row with 'owner' role
      const { error: memError } = await (supabase.from('memberships') as any).insert({
        org_id: orgId,
        user_id: user.id,
        role: 'owner',
      });

      if (memError) {
        console.error('Membership insert error:', memError);
        throw memError;
      }

      // Step F: Now that the user IS a member, SELECT will succeed under RLS!
      const { data: orgData } = await (supabase.from('organizations') as any)
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      const finalOrg: Organization = orgData || {
        id: orgId,
        name: name.trim(),
        slug: cleanSlug,
        created_by: user.id,
        default_timezone: 'UTC',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await refreshOrgs();
      setCurrentOrg(finalOrg);
      return finalOrg;
    } catch (err) {
      console.error('Failed to create organization:', err);
      return null;
    }
  };

  return (
    <OrgContext.Provider
      value={{
        currentOrg,
        organizations,
        currentRole,
        setCurrentOrg,
        loading,
        refreshOrgs,
        createOrganization,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
};

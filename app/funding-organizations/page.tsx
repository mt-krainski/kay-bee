"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, ExternalLink } from "lucide-react";

interface FundingOrganization {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function FundingOrganizationsPage() {
  const [organizations, setOrganizations] = useState<FundingOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    try {
      const response = await fetch("/api/funding-organizations");
      if (!response.ok) {
        throw new Error("Failed to fetch funding organizations");
      }
      const data = await response.json();
      console.log("Fetched organizations:", data.organizations);
      setOrganizations(data.organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      setError("Failed to load funding organizations");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading funding organizations...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Funding Organizations
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage funding organizations for grant applications
              </p>
            </div>
            <Link href="/funding-organizations/add">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Organization
              </Button>
            </Link>
          </div>
        </div>

        {organizations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No funding organizations yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Get started by adding your first funding organization.
                </p>
                <Link href="/funding-organizations/add">
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add First Organization
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Card key={org.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    {org.name}
                  </CardTitle>
                  {org.description && (
                    <CardDescription className="line-clamp-3">
                      {org.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Added{" "}
                      {org.created_at
                        ? (() => {
                            try {
                              return new Date(
                                org.created_at
                              ).toLocaleDateString();
                            } catch (error) {
                              console.error(
                                "Date parsing error:",
                                error,
                                org.created_at
                              );
                              return "Unknown date";
                            }
                          })()
                        : "Unknown date"}
                    </span>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

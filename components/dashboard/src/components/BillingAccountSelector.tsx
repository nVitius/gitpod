/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Team, TeamMemberInfo } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { getGitpodService } from "../service/service";
import { TeamsContext } from "../teams/teams-context";
import { UserContext } from "../user-context";
import SelectableCardSolid from "../components/SelectableCardSolid";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";

export function BillingAccountSelector(props: { onSelected?: () => void }) {
    const { user, setUser } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const [teamsAvailableForAttribution, setTeamsAvailableForAttribution] = useState<Team[] | undefined>();
    const [membersByTeam, setMembersByTeam] = useState<Record<string, TeamMemberInfo[]>>({});

    useEffect(() => {
        if (!teams) {
            setTeamsAvailableForAttribution(undefined);
            return;
        }

        // Filter teams based on whether they can actually "resolve" any credits thrown at them
        const teamsWithBilling: Team[] = [];
        Promise.all(
            teams.map(async (t) => {
                const attributionId: string = AttributionId.render({ kind: "team", teamId: t.id });
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);
                if (subscriptionId) {
                    teamsWithBilling.push(t);
                }
            }),
        ).then(() => setTeamsAvailableForAttribution(teamsWithBilling.sort((a, b) => (a.name > b.name ? 1 : -1))));

        const members: Record<string, TeamMemberInfo[]> = {};
        teams.forEach(async (team) => {
            try {
                members[team.id] = await getGitpodService().server.getTeamMembers(team.id);
            } catch (error) {
                console.error("Could not get members of team", team, error);
            }
        });
        setMembersByTeam(members);
    }, [teams]);

    const setUsageAttributionTeam = async (team?: Team) => {
        if (!user) {
            return;
        }
        const usageAttributionId = AttributionId.render(
            team ? { kind: "team", teamId: team.id } : { kind: "user", userId: user.id },
        );
        await getGitpodService().server.setUsageAttribution(usageAttributionId);
        // we changed the user, to let's propagate in the frontend
        setUser(await getGitpodService().server.getLoggedInUser());
        if (props.onSelected) {
            props.onSelected();
        }
    };

    let selectedAttributionId = user?.usageAttributionId || AttributionId.render({ kind: "user", userId: user?.id! });

    return (
        <>
            {teamsAvailableForAttribution === undefined && <Spinner className="m-2 h-5 w-5 animate-spin" />}
            {teamsAvailableForAttribution && (
                <div>
                    <p>Associate usage without a project to the billing account below.</p>
                    <div className="mt-4 max-w-2xl grid grid-cols-3 gap-3">
                        <SelectableCardSolid
                            className="h-18"
                            title="(myself)"
                            selected={
                                !!user &&
                                selectedAttributionId === AttributionId.render({ kind: "user", userId: user.id })
                            }
                            onClick={() => setUsageAttributionTeam(undefined)}
                        >
                            <div className="flex-grow flex items-end px-1">
                                <span className="text-sm text-gray-400">Personal Account</span>
                            </div>
                        </SelectableCardSolid>
                        {teamsAvailableForAttribution.map((t) => (
                            <SelectableCardSolid
                                className="h-18"
                                title={t.name}
                                selected={
                                    selectedAttributionId === AttributionId.render({ kind: "team", teamId: t.id })
                                }
                                onClick={() => setUsageAttributionTeam(t)}
                            >
                                <div className="flex-grow flex items-end px-1">
                                    <span className="text-sm text-gray-400">
                                        {!!membersByTeam[t.id]
                                            ? `${membersByTeam[t.id].length} member${
                                                  membersByTeam[t.id].length === 1 ? "" : "s"
                                              }`
                                            : "..."}
                                    </span>
                                </div>
                            </SelectableCardSolid>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

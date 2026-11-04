create policy rpc_only on eldervale_private.quest_definitions to authenticated using(false) with check(false);
create policy rpc_only on eldervale_private.player_quests to authenticated using(false) with check(false);
create index player_quests_quest_id on eldervale_private.player_quests(quest_id);

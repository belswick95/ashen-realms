-- Sample quest for quest system v2 (apply after db/quests-v2.sql): "A Bell Out of Tune", a short
-- Birchford quest proving requirements, stages, a branching choice with flags, cutscenes, unlocks
-- (teleport, NPC dialogue, world flag), an untradeable keepsake and an XP lamp. Original story.
-- Idempotent: the quest and its keepsake are added once (edit them later in the Game console).
-- Skips itself with a notice when the Birchford NPCs it uses are missing.
begin;
set local lock_timeout='5s';

-- The keepsake: untradeable, kept on death, never sold. Shown to clients via catalogOverrides.
insert into eldervale_private.realm_catalog(id,data) values('item:custom_morning_bell_charm',
 '{"name":"Morning Bell charm","description":"A thumb-sized brass bell on a leather cord, given by Sister Maud. It hums very faintly at dawn.","icon":"gem","custom":true,"ownerEdited":true,"category":"Quest items","buy":0,"sell":0,"unique":true,"tradeable":false,"untradeable":true,"questItem":true,"keepOnDeath":true,"shopless":true}'::jsonb)
on conflict(id) do nothing;

do $sample$
declare maud constant text:='96d6414a-90ce-4080-8515-adc6b4db298b';corin constant text:='8e1013ae-c555-4aff-a4ba-8425fb7a290a';jory constant text:='d1b26173-cd94-4a4f-be5f-7a4d4afa7ad8';
 d jsonb;
begin
 if (select count(*) from eldervale_private.realm_actors where id in (maud,corin,jory) and not deleted)<3 then
  raise notice 'Sample quest skipped: Sister Maud, Corin the Lamplighter or Jory the Errand Boy is missing';return;
 end if;
 d:=$quest${
  "name":"A Bell Out of Tune","key":"birchford-flat-bell","chain":"birchford","order":1,"questPoints":1,"published":true,
  "giver":"@maud","icon":"custom_morning_bell_charm",
  "description":"For a week the Morning Bell of Birchford has rung flat and muffled. Half the city blames a curse. Sister Maud would rather have an answer.",
  "requirements":{"quests":["tutorial-graduation"],"qp":5},
  "objectives":[],
  "dialogue":{
   "offer":[{"who":"npc","text":"You hear it too, don't you? The Morning Bell. It used to sing; now it thuds like a sack of turnips."},
            {"who":"npc","text":"Half the market says it is cursed. The other half says I have grown deaf. I would like to prove both halves wrong."},
            {"who":"player","text":"Where should I start?"},
            {"who":"npc","text":"Corin the Lamplighter walks every street before dawn. If anyone has seen something odd near the bell, it is him."}],
   "progress":[{"who":"npc","text":"Any news about my bell? The pigeons have started roosting in it. They never dared before."}],
   "complete":[{"who":"npc","text":"A new strap! Let me see... yes, this will hold the clapper true."},
               {"who":"npc","text":"Listen to that. Birchford will wake properly tomorrow. Take this charm, and the thanks of the temple."}]},
  "branchDialogue":[
   {"stage":"complete","ifFlags":{"told_truth":true},"lines":[
    {"who":"npc","text":"A new strap, and the truth with it. Fleece in my bell, and a grandmother who cannot sleep. Oh, Jory."},
    {"who":"npc","text":"I will ring the bell an hour later on the north side of the city. A temple should wake people, not wear them out. Take this charm, with my thanks."}]}],
  "stages":[
   {"id":"lamplighter","journal":"Sister Maud asked me to find out why the Morning Bell has rung flat for a week. Corin the Lamplighter walks the streets before dawn; he may have seen something.",
    "objectives":[{"type":"talk","target":"@corin","amount":1,"label":"Ask Corin the Lamplighter what he saw",
     "dialogue":[{"who":"npc","text":"A curse? Ha. Curses don't wear boots two sizes too big."},
                 {"who":"npc","text":"Three mornings running I saw young Jory sneaking up Bell Lane before first light, hugging an armful of something soft. Fleece, maybe."},
                 {"who":"player","text":"Jory the errand boy?"},
                 {"who":"npc","text":"The very same. You will find him running messages by the north gate, if he is not hiding."}]}]},
   {"id":"errand-boy","journal":"Corin saw Jory the errand boy creeping up Bell Lane before dawn with an armful of something soft. I should have a word with Jory near the north gate.",
    "npc":"@jory",
    "objectives":[{"type":"talk","target":"@jory","amount":1,"label":"Find Jory the Errand Boy by the north gate",
     "dialogue":[{"who":"player","text":"Jory, someone saw you climbing Bell Lane before dawn."},
                 {"who":"npc","text":"Me? No. Never. I was... delivering. Very early. To the bell."}]}],
    "dialogue":{"choice":[{"who":"npc","text":"All right! I stuffed the clapper with fleece. My gran is poorly, and that bell drags her out of her sleep every single morning."},
                          {"who":"npc","text":"Please don't tell the Sister. She'll think I'm a bell-wrecker."}]},
    "choices":[
     {"id":"keep-secret","label":"Your secret is safe. I'll mend the bell quietly.","flags":{"kept_secret":true},
      "dialogue":[{"who":"npc","text":"Honest? Thank you! I'll take the fleece out tonight, I promise."}]},
     {"id":"tell-truth","label":"Sister Maud deserves the truth. I'll tell her about your gran too.","flags":{"told_truth":true},
      "dialogue":[{"who":"npc","text":"...Fine. But tell her the whole of it, won't you? About Gran?"}]}]},
   {"id":"new-strap","journal":"The fleece is out, but it chewed through the clapper's old leather strap. Whatever I tell Sister Maud, the bell needs a new strap: I should bring her a piece of leather.",
    "onEnter":{"cutscene":"bell-strap"},
    "objectives":[{"type":"collect","target":"leather","amount":1,"label":"Bring Sister Maud a piece of leather"}]}],
  "cutscenes":{
   "bell-strap":{"name":"The worn strap","steps":[
    {"fade":"in","ms":700,"shot":{"eye":[-171,15,141],"look":[-185,9,120.4]}},
    {"title":"The Morning Bell","subtitle":"Temple of the Morning Bell, Birchford","ms":2400},
    {"npc":{"id":"@jory","face":[-185,120.4]}},
    {"say":{"who":"npc","name":"Jory the Errand Boy","text":"See that strap hanging off the clapper? The fleece wore it right through. It was only ever meant to be a quiet morning."},"shot":{"around":"@jory","distance":3.4,"height":1.8,"angle":35}},
    {"fade":"out","ms":600}]},
   "bell-rings":{"name":"The bell rings true","steps":[
    {"fade":"in","ms":600,"shot":{"eye":[-176,6,136],"look":[-185,10,120.4]}},
    {"title":"The Morning Bell rings true","subtitle":"Birchford wakes properly again","ms":2600},
    {"say":{"who":"npc","name":"Sister Maud","text":"Do you hear that? That is the sound of a city getting out of bed on time."},"shot":{"around":"@maud","distance":3,"height":1.7,"angle":-30}},
    {"fade":"out","ms":600}]}},
  "onComplete":{"cutscene":"bell-rings"},
  "journalDone":"I mended the Morning Bell's clapper strap, and the bell rings true over Birchford again.",
  "journalVariants":[{"ifFlags":{"kept_secret":true},"text":"I kept Jory's secret. Sister Maud still blames the pigeons."},
                     {"ifFlags":{"told_truth":true},"text":"I told Sister Maud the truth. She will ring the bell later on the north side so Jory's gran can sleep."}],
  "gold":120,"xp":{"crafting":1200},"items":{"custom_morning_bell_charm":1},
  "lamps":[{"perLevel":10,"minLevel":5,"label":"Bellwarden's lamp"}],
  "unlocks":[
   {"type":"teleport","id":"teleport.morning-bell","label":"Morning Bell teleport (temple steps, Birchford)","x":-185,"z":129.5},
   {"type":"flag","id":"birchford.bell_mended","label":"The Morning Bell rings true"},
   {"type":"dialogue","id":"dialogue.maud-bell","label":"Sister Maud remembers your help","npc":"@maud",
    "lines":[{"who":"npc","text":"Bless you for the bell, friend. Even the pigeons seem happier."},{"who":"npc","text":"If you ever need the temple steps in a hurry, the charm will remember the way."}]},
   {"type":"dialogue","id":"dialogue.jory-secret","label":"Jory trusts you","npc":"@jory","ifFlags":{"kept_secret":true},
    "lines":[{"who":"npc","text":"Gran slept till the second bell today! Our secret, right?"}]},
   {"type":"dialogue","id":"dialogue.jory-truth","label":"Jory forgives you, mostly","npc":"@jory","ifFlags":{"told_truth":true},
    "lines":[{"who":"npc","text":"The Sister rings it later on our side now. Gran says thank you. I say... fine, thank you too."}]}]
 }$quest$::jsonb;
 d:=replace(replace(replace(d::text,'@maud',maud),'@corin',corin),'@jory',jory)::jsonb;
 perform eldervale_private.quest_v2_check(d,'5b1e7a2c-3d4f-4e8a-9c0b-1f2e3d4c5b6a');
 insert into eldervale_private.quest_definitions(id,data) values('5b1e7a2c-3d4f-4e8a-9c0b-1f2e3d4c5b6a',d) on conflict(id) do nothing;
end $sample$;

commit;

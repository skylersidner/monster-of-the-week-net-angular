-- =============================================================================
-- Seed: "The Quiet" mystery
-- One-time data seed. Idempotent: skips if mystery already exists.
-- Type IDs are resolved by name via subqueries (no hardcoded GUIDs).
-- =============================================================================

DO $$
DECLARE
  v_mystery_id    uuid := gen_random_uuid();
  v_countdown_id  uuid := gen_random_uuid();
  v_monster1_id   uuid := gen_random_uuid();   -- All-Father Stillness
  v_minion1_id    uuid := gen_random_uuid();   -- The Disembodied Quiet
  v_location1_id  uuid := gen_random_uuid();   -- Alton's Bend
  v_location2_id  uuid := gen_random_uuid();   -- One Stop Grocery & Shop
  v_location3_id  uuid := gen_random_uuid();   -- The Quiet Commune
  v_bystander_id  uuid := gen_random_uuid();   -- Minnie Dennis
BEGIN

  -- Guard: skip if already seeded
  IF EXISTS (SELECT 1 FROM mysteries WHERE name = 'The Quiet') THEN
    RAISE NOTICE 'Mystery "The Quiet" already exists — skipping seed.';
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- Mystery
  -- -------------------------------------------------------------------------
  INSERT INTO mysteries (id, name, concept, hook, overview, notes, adventure_type_id, created_at, updated_at)
  VALUES (
    v_mystery_id,
    'The Quiet',
    'A movement known as The Quiet formed a small commune in the Arizona desert. Led by a man known as All-Father Stillness, the followers were dedicated to an extreme form of meditation in an attempt to free their minds from their bodies. The Quiet disappeared overnight years ago and was forgotten, with no evidence of their existence except for a smattering of concrete domes left in the desert next to the town of Alton''s Bend.',
    'The hunters are returning from a lead that turned out to be mundane: last year, some arrests were made in a town north of L.A. where a small group of people were caught digging up some graves in the local cemetery. During interviews, some of the individuals claimed to be part of a religious faction, called The Sunset Prayer Group stating that they wanted to bless the dead "just like the Mormons." They who were dug up were all bodies of people who had died in the two weeks and they were not related in any way to those jailed. The local police were full of tales about the "nut-job cultist mormons," but after they served their terms and paid fines, the trail went cold as the members seem to have gone off the grid. During their time at the station, they overheard two officers talking about an odd report by a visitor to a small town in the Mojave desert named Alton''s Bend who found the town empty. Of the residents, the visitor only found three corpses—in the gas station with rags shoved down their throats and wood in their ears. As they pass through the desert on the return to Kansas, they figured they''d check it out.',
    'The suicides were members of a local ''end times'' cult currently called the Sunset Prayer Group. A small gnostic sect that has survived since the Roman Empire under many names, they are trying to bring about the end of the world by means of necromancy. The necromancer Nathan Coin will be the last member of this cult. He plans to raise the four suicides as zombies and transform them into the Four Horsemen of the Apocalypse. He stole the bodies after burying them at the town graveyard.',
    NULL,
    'a1b2c3d4-5e6f-4a7b-8c9d-ef0123456789',  -- Thwart
    now(),
    now()
  );

  -- -------------------------------------------------------------------------
  -- Countdown
  -- -------------------------------------------------------------------------
  INSERT INTO countdowns (id, mystery_id, day, shadows, sunset, dusk, nightfall, midnight)
  VALUES (
    v_countdown_id,
    v_mystery_id,
    'Official (mundane) investigators are sent to the town. They will die.',
    'The Disembodied Quiet gather in number in Alton''s Bend.',
    'The Disembodied Quiet and the All-Father find and start killing the townspeople who have been in hiding.',
    'All-Father Stillness and his followers set out from Alton''s Bend to convert (aka ''silence'') any person they come across.',
    'All-Father Stillness gains power and influence over the minds of the living, converting them into becoming part of The Quiet.',
    'Religions dedicated to All-Father Stillness spread across the country and then the globe.'
  );

  -- -------------------------------------------------------------------------
  -- Monster 1: All-Father Stillness  (MonsterType = "Queen")
  -- -------------------------------------------------------------------------
  INSERT INTO monsters (id, monster_type_id, name, description, harm_capacity)
  VALUES (
    v_monster1_id,
    (SELECT id FROM monster_types WHERE name = 'Queen'),
    'All-Father Stillness',
    'Dr. Jon Hansen (or "All-Father Stillness") gathered followers under a movement he named "The Quiet." The Quiet was dedicated to shedding the physical world through meditation. Hansen was the first to achieve this willful separation of his spirit from his body. After this revelation, he brought the most proficient practitioners of his methods to the desert with him. After a year of training and preparation, they were cemented inside concrete domes with no doors or windows in an attempt to shut out the outside world completely. The members of The Quiet would succeed in transcendence or die in failure. All-Father Stillness walked deep into the desert and abandoned his body, committing himself fully to walking the Earth eternally as a spirit. After a long journey, he found his way back to the commune and waited for his followers to join him in their spirit forms. Once they gathered together, they would show the world what they had done and bring their "gift" to all. The All-Father will not show himself to the hunters until after at least two of his followers have been destroyed.',
    12
  );

  -- Powers — All-Father Stillness
  INSERT INTO monster_powers (id, monster_id, name, description)
  VALUES
    (gen_random_uuid(), v_monster1_id,
     'Invulnerable',
     'The hunters must force him to manifest, otherwise they cannot hurt him with physical attacks.'),
    (gen_random_uuid(), v_monster1_id,
     'Enforced Stillness',
     'He creates a zone of absolute silence in a 10-meter radius around himself. Within this zone an oppressive spectral force seeps into the bodies of the living, attacking them with Force of Silence each minute they are in the zone.');

  -- Attacks — All-Father Stillness
  INSERT INTO monster_attacks (id, monster_id, name, description, harm)
  VALUES
    (gen_random_uuid(), v_monster1_id, 'Choke',          '3-harm close ignore-armour.',                           3),
    (gen_random_uuid(), v_monster1_id, 'Force of Silence', '1-harm close magic ongoing (see Powers above).',      1);

  -- Armor — All-Father Stillness
  INSERT INTO monster_armors (id, monster_id, name, description, harm_soak, is_special, special_description)
  VALUES
    (gen_random_uuid(), v_monster1_id, 'Spiritual Resilience', NULL, 2, false, NULL);

  -- Weakness — All-Father Stillness
  INSERT INTO monster_weaknesses (id, monster_id, name, description)
  VALUES
    (gen_random_uuid(), v_monster1_id,
     'Loud Noises',
     'Loud noises will distract him to the point that his form wavers, causing him to manifest and become vulnerable to attack.');

  -- -------------------------------------------------------------------------
  -- Monster 2: The Disembodied Quiet  (MinionType = "Parasite")
  -- Ensure Parasite exists as a minion type (added here since it may not yet
  -- be present in the reference data).
  -- -------------------------------------------------------------------------
  INSERT INTO minion_types (id, name, motivation)
  SELECT gen_random_uuid(), 'Parasite', 'to consume and feed off its host'
  WHERE NOT EXISTS (SELECT 1 FROM minion_types WHERE name = 'Parasite');

  -- -------------------------------------------------------------------------
  -- Minion: The Disembodied Quiet  (MinionType = "Parasite", parent = All-Father Stillness)
  -- -------------------------------------------------------------------------
  INSERT INTO minions (id, monster_id, minion_type_id, name, description, harm_capacity, created_at, updated_at)
  VALUES (
    v_minion1_id,
    v_monster1_id,
    (SELECT id FROM minion_types WHERE name = 'Parasite'),
    'The Disembodied Quiet',
    'The members of The Quiet achieved transcendence and have gathered with All-Father Stillness in their spiritual form. Unfortunately they only transcended to being ghosts, trapped and unable to return to life or move on. Their only focus is to spread the "the gift" to anyone they see. Any noise provokes them to rage and to attempt to silence its source. Over the years, the distance they are able to roam has extended from the cement structures in which they died, putting Alton''s Bend in their path. They appear as semi-transparent versions of their human form, with long hair and naked bodies thinned by starvation. They stand still with disturbingly blank stares and will only move when unseen. Should anyone observing them turn away, or even blink, The Disembodied will suddenly be closer until they reach their ghostly hands deep into their victim''s throats.',
    5,
    now(),
    now()
  );

  -- Powers — The Disembodied Quiet
  INSERT INTO minion_powers (id, minion_id, name, description)
  VALUES
    (gen_random_uuid(), v_minion1_id,
     'Incorporeal',
     'The Disembodied Quiet are incorporeal forms who should be treated as having 3-armour (against any harm) unless their weakness is being exploited.');

  -- Attacks — The Disembodied Quiet
  INSERT INTO minion_attacks (id, minion_id, name, description, harm)
  VALUES
    (gen_random_uuid(), v_minion1_id, 'Choke', '3-harm close ignore-armour.', 3);

  -- Armor — The Disembodied Quiet
  INSERT INTO minion_armors (id, minion_id, name, description, harm_soak, is_special, special_description)
  VALUES
    (gen_random_uuid(), v_minion1_id, 'Spectral Form', NULL, 3, true, 'Incorporeal.');

  -- Weakness — The Disembodied Quiet
  INSERT INTO minion_weaknesses (id, minion_id, name, description)
  VALUES
    (gen_random_uuid(), v_minion1_id,
     'Noise',
     'Loud noises will distract the spirits to the point that their forms waver and they become vulnerable to attack. Their bodies (inside the cement structures) are vulnerable to physical destruction, which will also destroy the spirit.');

  -- -------------------------------------------------------------------------
  -- Locations
  -- -------------------------------------------------------------------------
  INSERT INTO locations (id, location_type_id, name, description)
  VALUES
    (v_location1_id,
     (SELECT id FROM location_types WHERE name = 'Prison'),
     'Alton''s Bend',
     'Alton''s Bend is little more than a cluster of buildings in a horseshoe arrangement, with the One Stop Gas & Grocery at the apex. The town is quite far away from civilisation: the tension can be ratcheted up by having no cell reception and the hunters'' vehicle running on fumes by the time they get there. After the countdown reaches Shadows, the bodies of two state police are found in the center of town near their patrol car. The town seems to have been hurriedly abandoned. The surviving residents are hiding, too scared to make any noise lest the Disembodied Quiet find them.'),
    (v_location2_id,
     (SELECT id FROM location_types WHERE name = 'Deathtrap'),
     'One Stop Grocery & Shop',
     'The hoses have been torn from the gas pumps, resulting in large puddles of gas soaking the surrounding gravel. Any kind of flame or spark could cause some serious damage to a large area. Inside the building is a combination gift shop, sandwich counter, and woefully small grocery. The door chime has been pulled down from above the door and smashed to pieces on the floor near the entryway. Dead bodies are in the kitchen and the basement storeroom. Broken pieces of broom handles have been shoved in their ears and dish rags shoved down their throats. The Disembodied Quiet patrol here and will soon see and stalk the hunters.'),
    (v_location3_id,
     (SELECT id FROM location_types WHERE name = 'Wilds'),
     'The Quiet Commune',
     'A banner hangs over what was the entrance to the commune. Now split in half and in tatters, it reads "THE QUIET IS STILL... HE MIND." Four-foot tall concrete domes are still very much intact and are a shining white after years of being bleached by the sun. The domes are completely sealed, their entrances having been seamlessly cemented over. Inside the domes are the naked and emaciated bodies of the members of The Quiet. A close check of the bodies reveals they are still alive. Their corporeal form has been slowed to such a point that they still possess the tiniest flicker of life, though there is no chance their spirits can rejoin them. Destroying these bodies will destroy the spirits instantly.');

  -- -------------------------------------------------------------------------
  -- Bystander: Minnie Dennis  (BystanderType = "Witness")
  -- -------------------------------------------------------------------------
  INSERT INTO bystanders (id, bystander_type_id, name, description)
  VALUES (
    v_bystander_id,
    (SELECT id FROM bystander_types WHERE name = 'Witness'),
    'Minnie Dennis',
    'Minnie was an administrative assistant working at the town hall who showed up late one day to work and found the town relatively empty. She bumped into Ari Ray, who tried to keep her quiet and show her a book (Crazy Cults of the Modern Era), but when she wouldn''t stop asking questions, knocked her cold. When she awoke, her car was gone. She went to the One Stop to get something to eat and shortly after opening the door, encountered one of the Disembodied Quiet. She has survived by avoiding making any noises and hiding in a coat closet in the town hall. Minnie is terrified and doesn''t know what to do. She only speaks in barely audible whispers when pressured and if the hunters allow her to, she will find a legal pad and pen to write all communication with them.'
  );

  -- -------------------------------------------------------------------------
  -- Mystery Custom Move: Bring the Noise
  -- -------------------------------------------------------------------------
  INSERT INTO mystery_custom_moves (id, mystery_id, name, description)
  VALUES (
    gen_random_uuid(),
    v_mystery_id,
    'Bring the Noise',
    'When making noise loud enough to drown out a conversation at 10 paces (e.g. banging on sheet metal, turning a car stereo up full blast) to disrupt the Disembodied Quiet, roll +(whichever Rating is most appropriate): On a 10+, all spirits in the nearby area are forced to manifest. When manifested, they are vulnerable to attack. On a 7-9, all spirits in the area are forced to manifest and the hunter chooses 1: All spirits in the area focus their attacks on you; All spirits in the area are enraged and now cause +1 harm (increasing each time this option is selected); The noise disorients you (–1 to Sharp for 30 minutes—this can only be chosen once per hunter). On a 6 or less, all spirits in the area focus their attacks on you.'
  );

  -- -------------------------------------------------------------------------
  -- Bridge table links: associate monsters, locations, bystander with mystery
  -- -------------------------------------------------------------------------
  -- Only the true monster links to the mystery; minions are accessed via their parent monster
  INSERT INTO mystery_monsters (mystery_id, monster_id) VALUES
    (v_mystery_id, v_monster1_id);

  INSERT INTO mystery_locations (mystery_id, location_id) VALUES
    (v_mystery_id, v_location1_id),
    (v_mystery_id, v_location2_id),
    (v_mystery_id, v_location3_id);

  INSERT INTO mystery_bystanders (mystery_id, bystander_id) VALUES
    (v_mystery_id, v_bystander_id);

  RAISE NOTICE 'Seed complete: mystery "The Quiet" inserted successfully.';

END $$;

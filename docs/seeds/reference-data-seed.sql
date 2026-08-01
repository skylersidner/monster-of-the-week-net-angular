-- =============================================================================
-- Reference Data Seed
-- Populates all lookup / reference tables:
--   adventure_types, monster_archetypes, monster_types, minion_types, location_types, bystander_types, weapon_tags
--
-- Idempotent: uses ON CONFLICT (id) DO NOTHING so it is safe to re-run.
-- UUIDs are fixed so data is consistent across environments.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Adventure Types
-- -----------------------------------------------------------------------------
INSERT INTO adventure_types (id, name, description) VALUES
  ('a1b2c3d4-5e6f-4a7b-8c9d-ef0123456789', 'Thwart',   'Hunters versus the Bad Guy.'),
  ('b2c3d4e5-6f7a-4b8c-9d0e-f01234567890', 'Collect',  'Hunters must get something important.'),
  ('c3d4e5f6-7a8b-4c9d-aef0-123456789012', 'Deliver',  'Hunters must transfer something important.'),
  ('d4e5f6a7-8b9c-4d0e-bf12-3456789abcde', 'Discover', 'Hunters must find something important.')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Monster Archetypes
-- -----------------------------------------------------------------------------
INSERT INTO monster_archetypes (id, name, description) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d401', 'Heavy Hitter', 'It is the threat'),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d402', 'Racer',        'Trying to achieve something'),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d403', 'Chaser',       'Pursuing the hunters'),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d404', 'Shadow',       'Up to something behind the scenes')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Monster Types
-- -----------------------------------------------------------------------------
INSERT INTO monster_types (id, name, motivation) VALUES
  ('f3538fb8-eb82-4b3e-8e6c-d9360eeea3af', 'Beast',       'To run wild, destroying and killing.'),
  ('d143ca82-70d4-40fb-8783-aea236fac1b0', 'Breeder',     'To give birth to, bring forth, or create evil.'),
  ('d3ef4a79-a748-40df-97cc-0a89d2f5d2de', 'Collector',   'To gather souls, things, or people.'),
  ('bc012263-4b80-4788-b4f1-5bedc1e03c92', 'Destroyer',   'To bring about the end of the world.'),
  ('72d4064f-d7e8-407d-ae87-7394c8ff0cc1', 'Devourer',    'To consume people and resources.'),
  ('de5e2cc7-f033-4db2-9c09-a8faec4fefe1', 'Executioner', 'To punish and enforce brutal rules.'),
  ('726eb798-e819-4de8-bec3-1bc95c4f09e8', 'Parasite',    'To infest, control and devour.'),
  ('41beb0af-b531-4e13-9574-e7375caa23e6', 'Queen',       'To possess and control.'),
  ('701a6e3e-b69a-4041-b84b-45ca29d7b35f', 'Sorcerer',    'To usurp unnatural power.'),
  ('8c4b719c-3ece-4a0c-9af5-4ae5a54ff28b', 'Tempter',     'To tempt people into evil deeds.'),
  ('9f97e451-a6c3-4ea1-b35f-d6125a38411e', 'Torturer',    'To hurt, terrify, and torment.'),
  ('9449bddb-3adc-4e3f-9fd2-70e024e381cb', 'Trickster',   'To create chaos.')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Minion Types
-- -----------------------------------------------------------------------------
INSERT INTO minion_types (id, name, motivation) VALUES
  ('e5a49a67-b6a2-47ca-b619-0afee9972d2d', 'Assassin',   'To kill the hunters.'),
  ('3e7bf8f5-0a82-40ca-9f90-f06939d07259', 'Brute',      'To intimidate and use force.'),
  ('d70f5d8a-2e0d-43fd-a6af-8c8fbe95d7cc', 'Cultist',    'To serve and empower the dark plan.'),
  ('89ca4251-d184-4df8-8cba-7a85e7bd4493', 'Guardian',   'To bar a way or protect something.'),
  ('fcb4f694-b15f-4e53-b58c-f30666f4f2f5', 'Hive',       'To swarm and overwhelm by numbers.'),
  ('8b5109f7-7f0e-453a-84e2-cbcf77d0c55a', 'Parasite',   'To consume and feed off its host.'),
  ('fd605fa1-882c-4cb9-8b17-1cb24af325f5', 'Plague',     'To spread disease, fear, or corruption.'),
  ('8d05b0f5-dd6e-46a9-b1db-9a548003f5c6', 'Renfield',   'To push victims towards the monster.'),
  ('e69640e8-44ae-45fe-9463-1c87536f13d8', 'Right Hand', 'To back up the monster.'),
  ('f3829ff0-91f1-44c7-84c7-fec1bd3f3ccf', 'Scout',      'To stalk, watch, and report.'),
  ('0df16b90-f7e8-4b8a-8300-f941e124a1cb', 'Thief',      'To steal and deliver to the monster.'),
  ('3a075ae5-90dc-4fa4-86d4-1b0b409a0960', 'Traitor',    'To betray people.')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Location Types
-- -----------------------------------------------------------------------------
INSERT INTO location_types (id, name, motivation) VALUES
  ('85be622b-8f89-46ad-84f6-df2d6d678f27', 'Crossroads', 'To bring people, and things, together.'),
  ('ad80e013-634d-4b4a-aa95-4874e8d8a5fc', 'Deathtrap',  'To harm intruders.'),
  ('9e63f793-92d1-40de-bf95-d0fda500659f', 'Den',        'To harbor monsters.'),
  ('c97a7826-f5e8-446e-833d-66e58d772137', 'Fortress',   'To deny entry.'),
  ('f1604043-47b4-43b0-aa22-813b642533da', 'Hellgate',   'To create evil.'),
  ('ffd42d4c-3e3e-4ffa-ab5a-5125c7dddfa1', 'Hub',        'To reveal information.'),
  ('fc78b08f-a7c5-4f2f-9ff4-9fda6b52604f', 'Lab',        'To create weirdness.'),
  ('f8ce54b0-ae68-4612-a102-b3a1aa148053', 'Maze',       'To confuse and separate.'),
  ('be4b6758-1838-43f0-b863-2800e31324d4', 'Prison',     'To constrain and prevent.'),
  ('c89b94d0-5ef1-488a-ad47-d9a80e909f5c', 'Wilds',      'To contain hidden things.')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Bystander Types
-- -----------------------------------------------------------------------------
INSERT INTO bystander_types (id, name, motivation) VALUES
  ('f6f43616-f0bc-4f58-b43e-65f64de5ec95', 'Busybody',  'To interfere in other people''s plans.'),
  ('bcaba3bd-8632-42db-acab-b082c897c521', 'Detective',  'To rule out explanations.'),
  ('42fdcc75-a96a-4a52-8e82-b4dcf75dbdf6', 'Gossip',    'To pass on rumors.'),
  ('4904b734-f521-4c23-b53c-e684096699c4', 'Helper',    'To join the hunt.'),
  ('a48db98f-3a7c-4721-9d31-1d8204cd8f72', 'Innocent',  'To do the right thing at great risk.'),
  ('9f2924a1-a914-413e-9859-c6a0e7262f4e', 'Official',  'To be suspicious.'),
  ('e946b780-3068-4b9b-901d-b2937e0b5e4e', 'Skeptic',   'To deny supernatural explanations.'),
  ('4f36b2af-68d5-4fc6-bdd1-46f5bd54fe2a', 'Victim',    'To put themselves in danger.'),
  ('52bb692b-dc82-4ee8-8a16-c7799b0b7636', 'Witness',   'To reveal information.')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Weapon Tags
-- -----------------------------------------------------------------------------
INSERT INTO weapon_tags (id, name, description) VALUES
  ('d44a0845-cf5c-4b4b-80c4-73a16f1edf6c', '1-harm',          'Deals 1 harm.'),
  ('e221c3a8-7e79-4a1e-a0a6-f1572bfffc9d', '2-harm',          'Deals 2 harm.'),
  ('c40611bc-e831-4139-85fc-02599d9aec41', '3-harm',          'Deals 3 harm.'),
  ('e286f1d6-b8a4-4179-ac37-d2cd29f6f9a0', 'area',            'Can hit multiple foes; divide harm inflicted among multiple targets.'),
  ('aca3a30d-a436-4217-ad8a-87f0b613ea14', 'armor',           'Reduces harm taken.'),
  ('cca7d96c-1e6c-406f-a368-79a93e47029b', 'auto',            'Attacks repeatedly, very quickly; can drain munition reserves.'),
  ('553d6721-17a2-4532-9fbc-1d7182ef5ef6', 'auto-targetting', 'Finds its own targets.'),
  ('473f2d87-5750-40b8-b5a1-9a962b0623dc', 'balanced',        'Easy to wield and grip.'),
  ('f3f65b00-0a7a-481a-9c24-3526a85caf24', 'barrier',         'Does harm to anything passing through; counts as armor against attacks that pass through.'),
  ('59d6ea9b-8470-47a3-bdde-31ce24b17314', 'batteries',       'Requires power (and may run out).'),
  ('8d8f5663-c9a2-425d-a7be-146db5df4dcf', 'close',           'Close quarters, but beyond arms reach.'),
  ('2c86c5f4-3188-4389-a6a3-ea810d0f54fd', 'cold/ice',        'Freezes or reduces temperature; may restrain.'),
  ('f11ca2c3-d0fb-4fca-baeb-d0280797c3c6', 'electric',        'Electrocutes targets; My stun or cause disarming.'),
  ('3fe580cf-34b9-45df-ac21-305270c42f35', 'far',             'Effective at long range.'),
  ('a874f935-d471-4115-8f34-5f58d2647557', 'fire',            'Sets things ablaze.'),
  ('eed44057-ca55-460e-bbde-6e444103f7d8', 'force',           'Creates pressure.'),
  ('8cf70669-1442-417e-845a-5880c6add7a5', 'forceful',        'Pushes things around.'),
  ('c56d03af-a809-4c5c-88f8-67a75237a149', 'fragile',         'Delicate and may break when used.'),
  ('ef0d8121-1362-4af8-a2ab-69474302057f', 'glass',           'Made of glass.'),
  ('3c879656-e35d-4b54-8fe9-1bde5c867269', 'gold',            'Made of gold.'),
  ('89f4e3fb-d62f-4ed6-8ac1-1e12b5d50f60', 'hand',            'Within arms reach.'),
  ('3dae2121-a68c-45b5-85c7-72152fc913fe', 'heavy',           'Difficult to wield and grip.'),
  ('e454f9e9-3858-4628-8b9b-7b0315e05657', 'holy',            'Extra effective against unholy/demonic/diabolical foes.'),
  ('2c4a48e6-6269-4ddf-b5f7-be5368a97d10', 'ignore-armor',    'Ignores protective armor; must also have "magic" to ignore magical armor.'),
  ('c0b94674-5229-4d3b-ad35-50147b94a5bc', 'intimate',        'Requires direct physical contact of your body.'),
  ('568250e3-53f3-4fba-ad97-2a254aba58be', 'iron',            'Made of iron.'),
  ('7db1b5ce-fa72-486d-99ae-69c19ba35980', 'large',           'Obvious and difficult to conceal.'),
  ('c721987c-22a4-443b-9bea-505710ef57b2', 'life-drain',      'Transfers life energy; heals for the harm that it deals.'),
  ('bed12c05-a907-4a9c-9d67-df71582b2081', 'loud',            'Makes noise and draws attention.'),
  ('b3f291ae-9eda-4871-8896-c8bec2f57933', 'magic',           'Enchanted; can affect foes with special armor.'),
  ('47544d23-6a0f-4668-b09f-144b6d9dbe7e', 'many',            'Small enough to carry a large number.'),
  ('b7cfa2ff-b85e-45d7-b4d9-03655edb13b8', 'messy',           'Spreads blood/gore around in a noticeable manner.'),
  ('9f2d4530-0d62-4ea4-bee2-ee05270dcf5a', 'organic',         'Made with (or entirely of) flesh/plant material.'),
  ('66c5d549-84eb-47d4-a5ba-e39e4d6692a5', 'quick',           'Attacks fast and early.'),
  ('6801160e-de6b-470a-ba7b-ba7eaeac1df3', 'quiet',           'Subtle or silent.'),
  ('fd8b7024-d3f6-47d4-9154-7dfa2bf731b7', 'recharge',        'Requires powering up of some kind from time to time.'),
  ('75e56d33-9eb3-46f9-bd78-042e359acfa6', 'reload',          'Requires ammunition and possibly time to attack again.'),
  ('3402a827-11fa-499b-b538-dffff308aa32', 'restraining',     'Grabs and entangles the target.'),
  ('5e685e56-f558-4bdf-a4e4-485195b323c2', 'returning',       'May return to the user when called/thrown.'),
  ('b2524793-981a-4553-a6c5-937cadfad42f', 'sedating',        'Causes target to lose consciousness.'),
  ('ffaf06f8-3070-4c5c-938d-73bcd606d3e9', 'silver',          'Made of silver.'),
  ('54e4dc0f-b83f-4fc5-ab23-085a4b12b1ce', 'slow',            'Attacks slowly or requires preparation.'),
  ('36dcd627-fc48-4aa2-b649-af48f75f7a99', 'small',           'Tiny and easy to conceal.'),
  ('af2fb824-7184-4edb-98ba-130aee1de647', 'stun',            'Stuns foes.'),
  ('e810f5ea-70a4-4a08-9f00-b0ab98cf473a', 'sturdy',          'Can handle significant strain before breaking.'),
  ('f424c535-35e4-4255-a124-f55475a1de08', 'unholy',          'Effective against holy/pious/angelic foes.'),
  ('81ff7f33-7b9f-4b14-8f36-9dca201f7c15', 'unpredictable',   'May have unexpected outcomes when used.'),
  ('b957a983-baea-43fa-9ac7-89f0b59d1921', 'unreliable',      'May fail without (or even with) maintenance.'),
  ('42c9edb6-75b1-4719-870b-ffccb7c2ea12', 'useful',          'Has additional uses outside of combat.'),
  ('b73fb628-dbe0-471e-aa97-cc1517ca3f87', 'valuable',        'Antique, or made of desirable materials.'),
  ('6c697692-be5b-41c4-b20c-ff883a9582bc', 'volatile',        'Dangerous or unstable.')
ON CONFLICT (id) DO NOTHING;

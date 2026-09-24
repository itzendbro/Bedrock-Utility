# Component reference

Generated from the schemas in `script.js` by `node test/gen-docs.mjs` — do not edit by hand.

Every component below appears as a toggle switch in the editor. Switching it on reveals the input fields listed here, and the values are written straight into the generated Bedrock JSON. Components marked with a version badge need at least that `format_version`.

## Entities

9 groups, 58 components.

### Attributes

#### `minecraft:health`

Maximum health of the entity.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Max health | number | 20 | Number of half-hearts. 20 = 10 hearts. |
| `min` | Min regen health | number | 0 | Health value used for natural regeneration. |

#### `minecraft:scale`

Multiplies the entity hit-box and model size.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Scale | number | 1 | 1 = vanilla size, 2 = twice as large. |

#### `minecraft:collision_box`

Width and height of the hit-box.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `width` | Width | number | 1 | |
| `height` | Height | number | 1 | |

#### `minecraft:knockback_resistance`

Resistance against knockback (0-1).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Resistance | number | 0 | 0 = none, 1 = immune to knockback. |

#### `minecraft:follow_range`

Distance at which the entity can follow a target.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | number | 16 | |
| `max` | Max | number | 0 | 0 = unlimited. |

#### `minecraft:breathable`

Air supply and drowning behaviour.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `total_supply` | Total supply | integer | 15 | Seconds of air before drowning. |
| `suffocate_time` | Suffocate time | integer | 0 | Time in bubbles before damage starts. |
| `breathes_air` | Breathes air | boolean | true | |
| `breathes_water` | Breathes water | boolean | — | |
| `breathes_solids` | Breathes solids | boolean | — | |
| `generates_bubbles` | Generates bubbles | boolean | true | |

### Identity

#### `minecraft:type_family`

Families this entity belongs to (used by filters).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `family` | Families | list (comma separated) | mob, monster | Comma separated, e.g. "mob, monster, mypack". |

#### `minecraft:variant`

Integer/text variant marker used by client textures.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | text | 0 | |

#### `minecraft:nameable`

Allows name tags.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `always_show` | Always show name | boolean | true | |
| `allow_name_tag_renaming` | Allow renaming | boolean | true | |

#### `minecraft:is_hidden_when_invisible`

Hides the entity while it has invisibility.

No fields — the component is enabled by its presence.

#### `minecraft:persistent`

Entity never despawns naturally.

No fields — the component is enabled by its presence.

### Lifecycle

#### `minecraft:despawn`

Distance / chance based despawning.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `despawn_from_distance` | Despawn from distance | boolean | true | |
| `min_distance` | Min distance | integer | 32 | Blocks. |
| `max_distance` | Max distance | integer | 128 | Blocks. |
| `despawn_from_chance` | Despawn from chance | number | 0 | 0 = disabled. |

#### `minecraft:ageable`

Baby / adult lifecycle.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `duration` | Duration | number | 1200 | Ticks as a baby (20 ticks = 1 s). |
| `grow_up` | Grow up event | text | — | Event fired when the baby becomes an adult. |
| `feed_items` | Feed items | list (comma separated) | — | Comma separated item ids that speed up growth. |
| `transform_to_item` | Transform to item | text | — | Item id the baby turns into. |
| `transform_to_item_amount` | Transform amount | integer | 1 | |
| `drop_items` | Drop items | list (comma separated) | — | Items dropped when the baby is not fed. |

#### `minecraft:breedable`

Breeding behaviour.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `require_tame` | Require tame | boolean | true | |
| `breed_items` | Breed items | list (comma separated) | minecraft:wheat | Comma separated item ids. |
| `causes_pregnancy` | Causes pregnancy | boolean | — | |
| `love_causes_pregnancy` | Love causes pregnancy | boolean | — | |
| `breed_cooldown` | Breed cooldown | number | 0 | |

#### `minecraft:experience_reward`

XP dropped on death / breeding.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `on_death` | On death | text | 3 | Number or a Molang expression. |
| `on_bred` | On bred | text | 1 | |

#### `minecraft:transformation`

Turns into another entity after a delay.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `into` | Into | text | minecraft:zombie | Target identifier. |
| `delay` | Delay | raw JSON | {} | Optional {"value":1,"block_association":"grass"} object. |
| `drop_equipment` | Drop equipment | boolean | true | |
| `keep_level` | Keep level | boolean | true | |
| `transformation_sound` | Transformation sound | text | — | |

### Movement

#### `minecraft:movement`

Movement speed of the entity.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `type` | Movement type | choice | normal | |
| `value` | Speed | number | 0.25 | Blocks per tick. |

#### `minecraft:navigation.generic`

Full pathfinding component (1.19.40+).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `is_amphibious` | Is amphibious | boolean | — | |
| `can_path_over_water` | Can path over water | boolean | — | |
| `avoid_water` | Avoid water | boolean | — | |
| `can_swim` | Can swim | boolean | — | |
| `can_walk` | Can walk | boolean | true | |
| `can_breach` | Can breach | boolean | — | |
| `avoid_damage_blocks` | Avoid damage blocks | boolean | — | |
| `can_open_doors` | Can open doors | boolean | — | |
| `can_open_iron_doors` | Can open iron doors | boolean | — | |
| `can_pass_doors` | Can pass doors | boolean | true | |
| `can_break_doors` | Can break doors | boolean | — | |
| `can_jump` | Can jump | boolean | true | |
| `can_sink` | Can sink | boolean | — | |
| `can_path_from_air` | Can path from air | boolean | — | |

#### `minecraft:navigation.walk`

Legacy walking pathfinding component.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `can_path_over_water` | Can path over water | boolean | — | |
| `avoid_water` | Avoid water | false | — | |
| `can_pass_doors` | Can pass doors | boolean | true | |
| `can_open_doors` | Can open doors | boolean | — | |
| `avoid_damage_blocks` | Avoid damage blocks | boolean | — | |
| `can_swim` | Can swim | boolean | — | |

#### `minecraft:navigation.float`

Floating pathfinding (used by most mobs).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `can_float` | Can float | boolean | true | |
| `can_path_over_water` | Can path over water | boolean | true | |
| `avoid_water` | Avoid water | boolean | — | |
| `can_sink` | Can sink | boolean | — | |

#### `minecraft:navigation.climb`

Pathfinding that can climb blocks.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `can_path_over_water` | Can path over water | boolean | — | |
| `avoid_water` | Avoid water | boolean | — | |

#### `minecraft:jump.static`

Base jump impulse.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `jump_power` | Jump power | number | 0.42 | |

### Physics

#### `minecraft:physics`

Gravity and collision with the world.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `has_gravity` | Has gravity | boolean | true | |
| `has_collision` | Has collision | boolean | true | |

#### `minecraft:pushable`

Whether other entities/pistons can push it.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `is_pushable` | Is pushable | boolean | true | |
| `is_pushable_by_piston` | Pushable by piston | boolean | true | |

#### `minecraft:fire_immune`

Entity takes no fire/lava damage.

No fields — the component is enabled by its presence.

### Combat

#### `minecraft:attack`

Melee damage dealt on contact.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `damage` | Damage | number | 3 | |
| `effect_name` | Effect name | text | — | e.g. poison |
| `effect_duration` | Effect duration | integer | 0 | Seconds. |

#### `minecraft:damage_sensor`

Custom reactions to damage sources.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Triggers | raw JSON | {
  "triggers": [
    {
      "on_damage": { "filters": "in_wall_or_risky" },
      "deals_damage": false
    }
  ]
} | Full JSON object with a "triggers" array. |

#### `minecraft:angry`

Temporary anger state after being hit.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `duration` | Duration | number | 20 | Seconds. |
| `broadcast_anger` | Broadcast anger | boolean | true | |
| `broadcast_range` | Broadcast range | integer | 20 | |
| `calm_event` | Calm event | text | — | |
| `angry_sound` | Angry sound | text | — | |

#### `minecraft:loot`

Loot table dropped on death.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `table` | Table path | text | loot_tables/entities/my_mob.json | |

### AI

#### `minecraft:behavior.float`

Swim / float up in liquids.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 0 | Lower runs first. |

#### `minecraft:behavior.panic`

Run away after taking damage.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 1 | |
| `speed_multiplier` | Speed multiplier | number | 1.25 | |
| `force` | Force panic | boolean | — | |
| `ignore_mob_damage` | Ignore mob damage | boolean | — | |
| `damage_sources` | Damage sources | list (comma separated) | — | Comma separated, e.g. "fall, fire". |

#### `minecraft:behavior.melee_attack`

Chase and hit the target.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 2 | |
| `speed_multiplier` | Speed multiplier | number | 1.25 | |
| `track_target` | Track target | boolean | true | |
| `reach_multiplier` | Reach multiplier | number | 1 | |
| `attack_once` | Attack once | boolean | — | |
| `cooldown_time` | Cooldown time | number | 1 | |
| `x_max_rotation` | X max rotation | number | 30 | |
| `y_max_rotation` | Y max rotation | number | 30 | |
| `require_complete_path` | Require complete path | boolean | true | |

#### `minecraft:behavior.nearest_attackable_target`

Pick the closest valid target.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 1 | |
| `must_see` | Must see | boolean | true | |
| `must_see_forget_duration` | Must see forget duration | number | 3 | |
| `within_radius` | Within radius | number | 0 | 0 = use follow_range. |
| `reselect_targets` | Reselect targets | boolean | true | |
| `attack_interval` | Attack interval | number | 1 | |
| `persist_time` | Persist time | number | 0 | |
| `scan_interval` | Scan interval | number | 1 | |
| `entity_types` | Entity types | raw JSON | {
  "entity_types": [
    {
      "filters": { "any_of": [
        { "test": "is_family", "subject": "other", "value": "player" },
        { "test": "is_family", "subject": "other", "value": "monster" }
      ] },
      "max_dist": 16
    }
  ]
} | Targeting filters. |

#### `minecraft:behavior.hurt_by_target`

Retaliate against whoever hurt it.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 1 | |
| `alert_same_type` | Alert same type | boolean | true | |
| `hurt_owner` | Hurt owner | boolean | — | |
| `entity_types` | Entity types | raw JSON | {
  "entity_types": [
    {
      "filters": { "any_of": [
        { "test": "is_family", "subject": "other", "value": "player" },
        { "test": "is_family", "subject": "other", "value": "monster" }
      ] },
      "max_dist": 16
    }
  ]
} | Who it retaliates against. |

#### `minecraft:behavior.random_stroll`

Wander around.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 6 | |
| `speed_multiplier` | Speed multiplier | number | 1 | |
| `xz_dist` | XZ distance | number | 10 | |
| `y_dist` | Y distance | number | 7 | |

#### `minecraft:behavior.random_look_around`

Idle head movement.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 8 | |
| `look_time` | Look time | text | [2, 4] | Min/max seconds as a vector. |

#### `minecraft:behavior.look_at_player`

Turn the head towards nearby players.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 7 | |
| `look_distance` | Look distance | number | 8 | |
| `angle_of_view_horizontal` | Horizontal angle of view | number | 90 | |
| `angle_of_view_vertical` | Vertical angle of view | number | 90 | |
| `probability` | Probability | number | 0.02 | |

#### `minecraft:behavior.follow_owner`

Follow its owner.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 4 | |
| `speed_multiplier` | Speed multiplier | number | 1 | |
| `start_distance` | Start distance | number | 10 | |
| `stop_distance` | Stop distance | number | 2 | |
| `max_distance` | Max distance | number | 20 | |
| `can_teleport` | Can teleport | boolean | true | |

#### `minecraft:behavior.follow_parent`

Babies follow their parent.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 5 | |
| `speed_multiplier` | Speed multiplier | number | 1.1 | |

#### `minecraft:behavior.follow_mob`

Follow another entity type.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 4 | |
| `speed_multiplier` | Speed multiplier | number | 1 | |
| `search_range` | Search range | number | 20 | |
| `stop_distance` | Stop distance | number | 2 | |
| `max_distance` | Max distance | number | 24 | |

#### `minecraft:behavior.avoid_mob`

Run away from a mob type.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 3 | |
| `speed_multiplier` | Speed multiplier | number | 1.2 | |
| `max_dist` | Max distance | number | 12 | |
| `min_dist` | Min distance | number | 8 | |
| `probability_per_tick` | Probability per tick | number | 0.001 | |
| `sneak_speed_multiplier` | Sneak speed multiplier | number | 0.6 | |
| `walk_speed_multiplier` | Walk speed multiplier | number | 1 | |
| `sprint_speed_multiplier` | Sprint speed multiplier | number | 1.4 | |
| `entity_types` | Entity types | raw JSON | {
  "entity_types": [
    {
      "filters": { "any_of": [
        { "test": "is_family", "subject": "other", "value": "player" },
        { "test": "is_family", "subject": "other", "value": "monster" }
      ] },
      "max_dist": 16
    }
  ]
} | What to avoid. |

#### `minecraft:behavior.tempt`

Lure the entity with items.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 2 | |
| `speed_multiplier` | Speed multiplier | number | 1.2 | |
| `within_radius` | Within radius | number | 10 | |
| `can_tempt_vertically` | Can tempt vertically | boolean | true | |
| `items` | Items | list (comma separated) | minecraft:wheat | Comma separated. |

#### `minecraft:behavior.pickup_items`

Pick up nearby items.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 6 | |
| `max_dist` | Max distance | number | 3 | |
| `goal_radius` | Goal radius | number | 2 | |
| `speed_multiplier` | Speed multiplier | number | 1 | |
| `can_pickup_to_hand` | Can pickup to hand | boolean | true | |

#### `minecraft:behavior.stay_while_sitting`

Do not move while sitting.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 3 | |

#### `minecraft:behavior.owner_hurt_by_target`

Attack whoever hurt the owner.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 1 | |

#### `minecraft:behavior.owner_hurt_target`

Attack the owner's target.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 2 | |

#### `minecraft:behavior.open_door`

Open and close doors while pathing.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 5 | |
| `close_door_after` | Close door after | boolean | true | |

#### `minecraft:behavior.circle_around_anchor`

Fly in circles around a point.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `priority` | Priority | integer | 3 | |
| `radius` | Radius | number | 8 | |
| `radius_change_chance` | Radius change chance | number | 250 | |
| `height_above_target_range` | Height above target range | number | 10 | |
| `height_offset_range` | Height offset range | number | 5 | |
| `height_change_chance` | Height change chance | number | 350 | |
| `goal_radius` | Goal radius | number | 1 | |
| `speed_multiplier` | Speed multiplier | number | 1 | |
| `angular_momentum` | Angular momentum | number | 10 | |

#### `minecraft:environment_sensor`

Run events when Molang filters match.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Triggers | raw JSON | {
  "triggers": [
    {
      "filters": { "test": "is_missing_health" },
      "event": "my_pack:on_low_health"
    }
  ]
} | Full JSON object with a "triggers" array. |

#### `minecraft:timer`

Fire an event on a timer.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `looping` | Looping | boolean | true | |
| `time` | Time | number | 1.8 | Seconds. |
| `time_down_event` | Time down event | text | — | |

### Interaction

#### `minecraft:tameable`

Tame with items.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `probability` | Probability | number | 0.33 | |
| `tame_items` | Tame items | list (comma separated) | minecraft:bone | Comma separated. |
| `tame_event` | Tame event | text | — | |

#### `minecraft:sittable`

Can be told to sit.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `event` | Event | text | — | |

#### `minecraft:leashable`

Can be put on a lead.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `soft_distance` | Soft distance | number | 4 | |
| `hard_distance` | Hard distance | number | 6 | |
| `max_distance` | Max distance | number | 10 | |
| `can_be_stolen` | Can be stolen | boolean | — | |

#### `minecraft:shareables`

Items it can hand to another entity.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `items` | Items | list (comma separated) | minecraft:wheat | Comma separated. |
| `items_wanted` | Items wanted | list (comma separated) | — | |
| `singular_pickup` | Singular pickup | boolean | — | |

#### `minecraft:is_saddled`

Shows the saddle texture while ridden.

No fields — the component is enabled by its presence.

#### `minecraft:boss`

Boss bar and sky darkening.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `should_darken_sky` | Should darken sky | boolean | true | |
| `hud_range` | HUD range | integer | 50 | |
| `name` | Name | text | — | Leave blank to use the entity name. |

#### `minecraft:home`

Stay inside a radius of its home.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `restriction_radius` | Restriction radius | integer | 4 | |

### Misc

#### `minecraft:conditional_bandwidth_optimization`

Reduces network traffic for distant entities.

No fields — the component is enabled by its presence.

## Items

5 groups, 27 components.

### Appearance

#### `minecraft:display_name`

In-game name (overrides the .lang entry).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | text | — | Plain text or a translation key. |

#### `minecraft:hover_text_color`

Colour of the item name tooltip.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | text | aqua | Colour name, e.g. "aqua", "light_purple". |

#### `minecraft:glint`

Enchantment-style shine.

No fields — the component is enabled by its presence.

#### `minecraft:hand_equipped`

Item is held like a tool.

No fields — the component is enabled by its presence.

#### `minecraft:wearable`

Equip slot of the item.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `slot` | Slot | choice | slot.armor.head | |

### Misc

#### `minecraft:max_stack_size`

How many fit in one slot.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | integer | 64 | 1-64. |

#### `minecraft:stacked_by_data`

Different aux values still stack together.

No fields — the component is enabled by its presence.

#### `minecraft:should_despawn`

Item despawns after 5 minutes.

No fields — the component is enabled by its presence.

#### `minecraft:ignores_permission`

Usable in adventure mode without permissions.

No fields — the component is enabled by its presence.

#### `minecraft:liquid_clipped`

Item is not slowed by liquids.

No fields — the component is enabled by its presence.

#### `minecraft:can_destroy_in_creative`

Breaks blocks in creative.

No fields — the component is enabled by its presence.

#### `minecraft:tags`

Item tags used by vanilla systems.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `tags` | Tags | list (comma separated) | minecraft:is_tool | Comma separated. |

#### `minecraft:compostable`

Composting chance.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `composting_chance` | Chance | number | 30 | 0-100. |

#### `minecraft:fuel`

Burn time in a furnace.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `duration` | Duration | number | 20 | Seconds. |

### Combat

#### `minecraft:damage`

Damage dealt when used as a weapon.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | integer | 5 | |

#### `minecraft:armor`

Armor points while worn.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `protection` | Protection | integer | 3 | Half-shields of protection. |

#### `minecraft:durability`

Durability of the item.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Durability | raw JSON | {
  "max_durability": 250,
  "damage_chance": { "min": 10, "max": 50 }
} | max_durability + damage_chance. |

#### `minecraft:repairable`

Repair with materials.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Repair items | raw JSON | {
  "repair_items": [
    { "items": ["minecraft:iron_ingot"], "repair_amount": 100 }
  ]
} | |

#### `minecraft:enchantable`

Enchantment slot and value.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `slot` | Slot | text | sword | |
| `value` | Value | integer | 10 | |

#### `minecraft:projectile`

Entity fired when shot.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `projectile_entity` | Projectile entity | text | minecraft:arrow | |
| `minimum_critical_power` | Minimum critical power | number | 1 | |

#### `minecraft:shooter` · requires format_version 1.20.60+

Draw-and-release behaviour (1.20.60+).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Shooter | raw JSON | {
  "charge_on_draw": false,
  "max_draw_duration": 1.0,
  "scale_power_by_draw_duration": true
} | |

### Food

#### `minecraft:food`

Edible item.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `nutrition` | Nutrition | integer | 4 | Hunger points restored. |
| `saturation` | Saturation | number | 0.8 | Saturation modifier. |
| `can_always_eat` | Can always eat | boolean | — | |
| `using_converts_to` | Using converts to | text | — | Item left behind, e.g. minecraft:bowl. |

### Behavior

#### `minecraft:cooldown`

Reuse delay after use.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `category` | Category | text | my_item | Shared cooldown category. |
| `duration` | Duration | number | 3 | Seconds. |

#### `minecraft:use_modifiers` · requires format_version 1.21.30+

Movement / duration while using (1.21.30+).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `movement_modifier` | Movement modifier | number | 0.35 | |
| `use_duration` | Use duration | number | 0 | |

#### `minecraft:digger`

Mining speeds of a tool.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Digger | raw JSON | {
  "destroy_speeds": [
    { "block": "minecraft:dirt", "speed": 4 },
    { "block": { "tags": "q.any_tag("stone")" }, "speed": 6 }
  ],
  "use_efficiency": true
} | |

#### `minecraft:chargeable` · requires format_version 1.20.60+

Charge up while holding (1.20.60+).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Chargeable | raw JSON | {
  "ammunition": [ { "item": "minecraft:arrow", "search_inventory": true, "use_offhand": true, "use_inventory": true } ],
  "charge_on_draw": false,
  "max_draw_duration": 1.0,
  "scale_power_by_draw_duration": true
} | |

#### `minecraft:block_placer` · requires format_version 1.21.20+

Places a block on use (1.21.20+).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `block` | Block | text | minecraft:dirt | |
| `use_on` | Use on | list (comma separated) | — | Comma separated block ids. Empty = any. |

## Blocks

5 groups, 28 components.

### Appearance

#### `minecraft:display_name`

In-game name of the block item.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | text | — | |

#### `minecraft:map_color`

Colour shown on maps.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | colour | #ffffff | Hex colour, e.g. #ff0000. |

#### `minecraft:geometry`

Custom block model.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `identifier` | Geometry identifier | text | geometry.my_block | |
| `culling` | Culling identifier | text | — | Optional. |

#### `minecraft:material_instances`

Per-face textures (advanced override).

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Material instances | raw JSON | {
  "*": { "texture": "textures/blocks/my_block", "render_method": "opaque" },
  "up": { "texture": "textures/blocks/my_block_top", "render_method": "opaque" }
} | Only needed to override the texture mapping built on the Assets tab. |

#### `minecraft:destruction_particles`

Particles spawned on break.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `texture` | Texture | text | textures/blocks/my_block | |

#### `minecraft:random_offset`

Random position offset when placed.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `x` | X | number | 0 | 0-1 |
| `y` | Y | number | 0 | 0-1 |
| `z` | Z | number | 0 | 0-1 |

### Physics

#### `minecraft:destructible_by_mining`

Mining time.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `seconds_to_destroy` | Seconds to destroy | number | 1 | 0 = instant. |

#### `minecraft:destructible_by_explosion`

Blast resistance.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `explosion_resistance` | Explosion resistance | number | 1 | |

#### `minecraft:friction`

Slipperiness of the block.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | number | 0.6 | Ice is 0.98. |

#### `minecraft:light_dampening`

Light blocked by the block.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | integer | 15 | 0-15. |

#### `minecraft:light_emission`

Light emitted by the block.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | integer | 0 | 0-15. |

#### `minecraft:collision_box`

Collision area in pixels.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `ox` | Origin X | number | -8 | |
| `oy` | Origin Y | number | 0 | |
| `oz` | Origin Z | number | -8 | |
| `sx` | Size X | number | 16 | |
| `sy` | Size Y | number | 16 | |
| `sz` | Size Z | number | 16 | |

#### `minecraft:selection_box`

Mouse-over outline in pixels.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `ox` | Origin X | number | -8 | |
| `oy` | Origin Y | number | 0 | |
| `oz` | Origin Z | number | -8 | |
| `sx` | Size X | number | 16 | |
| `sy` | Size Y | number | 16 | |
| `sz` | Size Z | number | 16 | |

#### `minecraft:flammable`

Fire behaviour.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `flame_odds` | Flame odds | integer | 0 | Chance of catching fire, 0-1000. |
| `burn_odds` | Burn odds | integer | 0 | Chance of burning away, 0-1000. |

### Misc

#### `minecraft:loot`

Drops when broken.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `table` | Table path | text | loot_tables/blocks/my_block.json | |

#### `minecraft:tags`

Block tags.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `tags` | Tags | list (comma separated) | minecraft:is_pickaxe_item_destructible | Comma separated. |

#### `minecraft:replaceable`

Replaced when another block is placed.

No fields — the component is enabled by its presence.

#### `minecraft:movable`

Can be pushed by pistons.

No fields — the component is enabled by its presence.

#### `minecraft:sound`

Step / break sounds and volume.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `sound` | Sound event | text | — | |
| `volume` | Volume | number | 1 | |
| `pitch` | Pitch | number | 1 | |

#### `minecraft:precipitation_interactions`

Rain/snow interactions.

No fields — the component is enabled by its presence.

### Interaction

#### `minecraft:placement_filter`

Where the block can be placed.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Conditions | raw JSON | {
  "conditions": [
    {
      "block_filter": ["minecraft:grass_block", "minecraft:dirt"],
      "allowed_faces": ["up"]
    }
  ]
} | |

#### `minecraft:crafting_table`

Opens a crafting grid.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `grid_size` | Grid size | integer | 3 | 2 or 3. |
| `crafting_tags` | Crafting tags | list (comma separated) | crafting_table | Comma separated. |

#### `minecraft:redstone_conductivity`

Conducts redstone.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | Value | choice | none | |

#### `minecraft:redstone_consumer`

Receives redstone signal.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Consumer | raw JSON | { "minimum_signal": 1 } | |

#### `minecraft:redstone_producer`

Emits redstone signal.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Producer | raw JSON | {
  "power": 15,
  "connections": ["up", "down", "north", "south", "east", "west"]
} | |

### Behavior

#### `minecraft:tick`

Random / queued ticking.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `interval` | Interval | number | 1 | Seconds (0 = random). |
| `looping` | Looping | boolean | true | |

#### `minecraft:transformation`

Turns into another block when ticked.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Transformation | raw JSON | {
  "into": "minecraft:air",
  "transformation_sound": "dig.grass"
} | |

#### `minecraft:liquid_detection`

Liquid detection rules.

| Field | Label | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `_raw` | Liquid detection | raw JSON | {} | Empty object = default behaviour. |

## Custom components

Any component that is not in the list above can be added as raw JSON from the *Custom JSON* tab (or the *Add custom component* button on the Components tab). The key and value are merged into the generated file exactly as written, so the editor never has to know about them.

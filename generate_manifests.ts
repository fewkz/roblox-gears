import { stringify as yaml_stringify } from "https://deno.land/std@0.157.0/encoding/yaml.ts";
import { sha256 } from "https://denopkg.com/chiefbiiko/sha256@v1.0.0/mod.ts";
import { snakeCase } from "https://deno.land/x/case@2.1.1/mod.ts";
import { emptyDirSync } from "https://deno.land/std@0.157.0/fs/mod.ts";
import { assert } from "https://deno.land/std@0.157.0/_util/assert.ts";

function hashId(id: number) {
  const hash = sha256(id.toFixed(), "utf8", "hex");
  assert(typeof hash == "string");
  return hash.substring(0, 8);
}

type Gear = {
  id: number;
  name: string;
  description: string;
  onsale: boolean;
  created: Date;
  updated: Date;
};

emptyDirSync("gears");
async function processGear(gear: Gear) {
  const hash = hashId(gear.id);
  const snakedName = snakeCase(gear.name).replace("_s_", "s_") + `_${hash}`;
  const firstLetter = snakedName.substring(0, 1);
  const root = `gears/${firstLetter}/${snakedName}`;
  const tags: string[] = [];
  tags.push(gear.onsale ? "Onsale" : "Offsale");
  const manifestBody = yaml_stringify({
    id: gear.id,
    created: gear.created,
    updated: gear.updated,
    name: gear.name,
    description: gear.description,
    tags: tags,
  });
  await Deno.mkdir(root, {
    recursive: true,
  });
  await Deno.writeTextFile(`${root}/manifest.yaml`, manifestBody);
}

interface Details {
  TargetId: unknown;
  Name: unknown;
  AssetId: unknown;
  ProductId: unknown;
  Description: unknown;
  AssetTypeId: unknown;
  Created: unknown;
  Updated: unknown;
  IsNew: unknown;
  IsForSale: unknown;
  IsPublicDomain: unknown;
  IsLimited: unknown;
  IsLimitedUnique: unknown;
}

async function getDetails(id: number) {
  const res = await fetch(`https://economy.roproxy.com/v2/assets/${id}/details`);
  const body: Details = await res.json();
  console.log(body);
  return body;
}

async function getGearInfo(id: number) {
  const {
    Name: name,
    IsForSale: onsale,
    Description: description,
    Created: createdString,
    Updated: updatedString,
  } = await getDetails(id);
  assert(typeof id == "number", "Gear details didn't provide a valid AssetId field");
  assert(typeof name == "string", "Gear details didn't provide a valid Name field");
  assert(typeof description == "string", "Gear details didn't provide a valid Description field");
  assert(typeof onsale == "boolean", "Gear details didn't have a valid IsForSale field");
  const created = new Date(createdString as string);
  const updated = new Date(updatedString as string);

  const gear: Gear = { id, name, onsale, description, created, updated };
  return gear;
}

import { chunk } from "https://deno.land/std@0.158.0/collections/chunk.ts";
import ids from "./ids.json" assert { type: "json" };

for (const idChunk of chunk(ids, 120)) {
  await Promise.all(idChunk.map((id) => getGearInfo(id).then((gear) => processGear(gear))));
}

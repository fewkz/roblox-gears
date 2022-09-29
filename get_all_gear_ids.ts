async function getIdsPage(cursor: string, minPrice?: number, maxPrice?: number, sort = "Updated") {
  const params = new URLSearchParams({
    category: "Accessories",
    includeNotForSale: "true",
    limit: "120",
    sortType: sort,
    subcategory: "Gear",
    minPrice: minPrice ? minPrice.toFixed() : "",
    maxPrice: maxPrice ? maxPrice.toFixed() : "",
    cursor: cursor,
  });
  const res = await fetch("https://catalog.roproxy.com/v1/search/items?" + params);
  const body = await res.json();
  if (body.errors) {
    throw new Error(body.errors[0].message);
  }
  // deno-lint-ignore no-explicit-any
  const ids: number[] = body.data ? body.data.map((entry: { id: any }) => entry.id) : [];
  return {
    nextCursor: body.nextPageCursor,
    data: ids,
  };
}

async function getIdsInPriceRange(minPrice?: number, maxPrice?: number, sort?: string) {
  const ids: number[] = [];
  let lastCursor = "";
  let first = true;
  while (lastCursor || first) {
    const res = await getIdsPage(lastCursor, minPrice, maxPrice, sort).catch((error) => {
      console.log(error);
      return getIdsPage(lastCursor, minPrice, maxPrice, sort);
    });
    res.data.forEach((id) => ids.push(id));
    lastCursor = res.nextCursor;
    first = false;
  }
  return ids;
}

const priceRanges = [
  [0, 200],
  [201, 300],
  [301, 400],
  [401, 500],
  [501, 750],
  [751, 1000],
  [1001, 10_000],
];

async function getAllGearIds() {
  const allIds = [];
  let last = 0;
  for (const [minPrice, maxPrice] of priceRanges) {
    const minString = minPrice.toLocaleString("en-us");
    const maxString = maxPrice.toLocaleString("en-us");
    const ids = await getIdsInPriceRange(minPrice, maxPrice);
    console.log(`Fetched ${ids.length} gears from prices ${minString} to ${maxString}`);
    allIds.push(...ids);
    last = maxPrice;
  }
  {
    const minPrice = last + 1;
    const startString = minPrice.toLocaleString("en-us");
    const ids = await getIdsInPriceRange(minPrice);
    console.log(`Fetched ${ids.length} gears above price ${startString}`);
    allIds.push(...ids);
  }
  { // Try to find offsale items by searching the recently updated sort.
    const ids = await getIdsInPriceRange(undefined, undefined, "Updated");
    console.log(`Fetched ${ids.length} recently updated gears with no price ranges`);
    allIds.push(...ids);
  }
  { // Try to find offsale items by searching the bestselling sort.
    const ids = await getIdsInPriceRange(undefined, undefined, "Sales");
    console.log(`Fetched ${ids.length} bestselling gears with no price ranges`);
    allIds.push(...ids);
  }
  { // Try to find offsale items by searching the most favorited sort.
    const ids = await getIdsInPriceRange(undefined, undefined, "Favorited");
    console.log(`Fetched ${ids.length} most favorited gears with no price ranges`);
    allIds.push(...ids);
  }

  const uniqueIds = [...new Set(allIds)];
  uniqueIds.sort((a, b) => a > b ? 1 : -1);

  return uniqueIds;
}

const ids = await getAllGearIds();
Deno.writeTextFileSync("ids.json", JSON.stringify(ids, null, 2));

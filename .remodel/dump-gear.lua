local assetId, outputDir = ...

assert(assetId, "No asset id provided!")
assert(outputDir, "No output directory provided!")

local DRY_RUN = false

if not DRY_RUN then
	remodel.createDirAll(outputDir .. "/src/")
end

local function writeModelFile(dir, instance)
	if DRY_RUN then
		print("Writing model file", dir)
	else
		remodel.writeModelFile(instance, dir)
	end
end

local function writeFile(dir, text)
	if DRY_RUN then
		print("Writing text file ", dir)
	else
		remodel.writeFile(dir, text)
	end
end

local suc, root = pcall(remodel.readModelAsset, assetId)
if not suc then
	error("Failed to load gear " .. assetId .. " due to error " .. tostring(root))
end

local gear
for i, v in pairs(root) do
	if v.ClassName == "Tool" then
		gear = v
	end
end

if not gear then
	error("Failed to load gear " .. assetId .. " due to it not having a Tool")
end

local function getRawProperty(instance, prop)
	return remodel.getRawProperty(instance, prop)
end

local grip = getRawProperty(gear, "Grip")

local function getTextureProperty(instance, prop)
	local url = getRawProperty(instance, prop)
	assert(url, "Tried to find non-existent texture property " .. prop)
	local id = select(3, string.find(url, "(%d+)"))
	if id then
		return "rbxassetid://" .. id
	else
		return ""
	end
end

local rojoProjectTree = {
	["$className"] = "Tool",
	["$properties"] = {
		CanBeDropped = getRawProperty(gear, "CanBeDropped") == true,
		ManualActivationOnly = getRawProperty(gear, "ManualActivationOnly") == true,
		RequiresHandle = getRawProperty(gear, "RequiresHandle") == true,
		ToolTip = getRawProperty(gear, "ToolTip"),
		TextureId = getTextureProperty(gear, "TextureId"),
		Grip = {
			grip.X,
			grip.Y,
			grip.Z,
			grip.XVector.X,
			grip.XVector.Y,
			grip.XVector.Z,
			grip.YVector.X,
			grip.YVector.Y,
			grip.YVector.Z,
			grip.ZVector.X,
			grip.ZVector.Y,
			grip.ZVector.Z,
		},
	},
}

local function isBaseValue(instance)
	return (
		instance.ClassName == "BoolValue"
		or instance.ClassName == "StringValue"
		or instance.ClassName == "NumberValue"
		or instance.ClassName == "IntValue"
	)
end

local function processChild(instance)
	if instance.Name == "ThumbnailCamera" or instance.Name == "ThumbnailPose" then
		return
	end
	if instance.ClassName == "Animation" then
		rojoProjectTree[instance.Name] = {
			["$className"] = "Animation",
			["$properties"] = {
				AnimationId = getTextureProperty(instance, "AnimationId"),
			},
		}
		return
	elseif isBaseValue(instance) then
		rojoProjectTree[instance.Name] = {
			["$className"] = instance.ClassName,
			["$properties"] = {
				Value = getRawProperty(instance, "Value"),
			},
		}
		return
	end
	local dir
	if instance.ClassName == "ModuleScript" then
		dir = "src/" .. instance.Name .. ".lua"
		writeFile(outputDir .. "/" .. dir, getRawProperty(instance, "Source"))
	elseif instance.ClassName == "Script" then
		dir = "src/" .. instance.Name .. ".server.lua"
		writeFile(outputDir .. "/" .. dir, getRawProperty(instance, "Source"))
	elseif instance.ClassName == "LocalScript" then
		dir = "src/" .. instance.Name .. ".client.lua"
		writeFile(outputDir .. "/" .. dir, getRawProperty(instance, "Source"))
	elseif instance.ClassName == "MeshPart" then
		dir = "src/" .. instance.Name .. ".rbxm"
		writeModelFile(outputDir .. "/" .. dir, instance)
	else
		dir = "src/" .. instance.Name .. ".rbxmx"
		writeModelFile(outputDir .. "/" .. dir, instance)
	end
	rojoProjectTree[instance.Name] = {
		["$path"] = dir,
	}
end

-- local children = gear:GetChildren()
-- for i, v in pairs(children) do
-- 	processChild(v)
-- end

local rojoProjectTree = {
	["$path"] = "src.rbxmx",
}

local children = gear:GetChildren()
for i, instance in pairs(children) do
	local isScript = true
	if instance.ClassName == "ModuleScript" then
		dir = "src/" .. instance.Name .. ".lua"
		writeFile(outputDir .. "/" .. dir, getRawProperty(instance, "Source"))
	elseif instance.ClassName == "Script" then
		dir = "src/" .. instance.Name .. ".server.lua"
		writeFile(outputDir .. "/" .. dir, getRawProperty(instance, "Source"))
	elseif instance.ClassName == "LocalScript" then
		dir = "src/" .. instance.Name .. ".client.lua"
		writeFile(outputDir .. "/" .. dir, getRawProperty(instance, "Source"))
	else
		isScript = false
	end
	if isScript then
		instance.Parent = nil
		rojoProjectTree[instance.Name] = {
			["$path"] = dir,
		}
	end
end

writeModelFile(outputDir .. "/src.rbxmx", gear)

writeFile(
	outputDir .. "/default.project.json",
	json.toString({ -- Don't use the pretty version because we want to deno to format it.
		name = gear.Name, -- In the fork, we should use the name of the gear on Roblox's website instead.
		tree = rojoProjectTree,
	})
)

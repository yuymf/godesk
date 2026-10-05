"""
G3D-20 pieces (渔村/港镇/雾灯) + G3D-19 sheep + procedural road hint.
Run: blender --background --python scripts/blender/gen_pieces_and_sheep.py
"""
import bpy
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/models"
OUT.mkdir(parents=True, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def shade_flat(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False


def export_glb(path: Path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="NONE",
    )


def mat(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = 0.7
    return m


def add_box(name, loc, scale, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat(name + "_mat", color))
    shade_flat(o)
    return o


def add_cyl(name, loc, r, d, color, verts=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat(name + "_mat", color))
    shade_flat(o)
    return o


def add_cone(name, loc, r1, d, color, verts=8):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, depth=d, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat(name + "_mat", color))
    shade_flat(o)
    return o


def make_sheep():
    reset()
    body = add_cyl("sheep_body", (0, 0, 0.35), 0.35, 0.5, (0.9, 0.9, 0.85), 10)
    body.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    head = add_cyl("sheep_head", (0.38, 0, 0.45), 0.18, 0.28, (0.85, 0.85, 0.8), 8)
    head.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    legs = []
    for i, (x, y) in enumerate([(-0.18, -0.18), (-0.18, 0.18), (0.15, -0.18), (0.15, 0.18)]):
        legs.append(add_cyl(f"sheep_leg{i}", (x, y, 0.12), 0.05, 0.24, (0.15, 0.12, 0.1), 6))
    objs = [body, head] + legs
    # join
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    sheep = bpy.context.active_object
    sheep.name = "sheep"
    export_glb(OUT / "sheep.glb", [sheep])
    print("sheep tris", len(sheep.data.polygons))


def make_settlement():
    reset()
    base = add_box("hut_base", (0, 0, 0.2), (0.7, 0.55, 0.4), (0.55, 0.4, 0.25))
    roof = add_cone("hut_roof", (0, 0, 0.55), 0.55, 0.45, (0.45, 0.2, 0.15), 4)
    roof.rotation_euler = (0, 0, math.pi / 4)
    bpy.ops.object.transform_apply(rotation=True)
    chimney = add_box("hut_chimney", (0.2, 0.15, 0.7), (0.12, 0.12, 0.25), (0.35, 0.35, 0.35))
    bpy.ops.object.select_all(action="DESELECT")
    for o in (base, roof, chimney):
        o.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = "settlement"
    export_glb(OUT / "settlement.glb", [o])
    print("settlement tris", len(o.data.polygons))


def make_city():
    reset()
    parts = []
    parts.append(add_box("city_a", (-0.25, 0, 0.35), (0.55, 0.55, 0.7), (0.5, 0.38, 0.28)))
    parts.append(add_box("city_b", (0.35, 0.1, 0.25), (0.45, 0.45, 0.5), (0.55, 0.4, 0.3)))
    parts.append(add_cone("city_roof", (-0.25, 0, 0.85), 0.42, 0.35, (0.4, 0.18, 0.12), 4))
    parts[-1].rotation_euler = (0, 0, math.pi / 4)
    bpy.ops.object.transform_apply(rotation=True)
    parts.append(add_cyl("city_tower", (0.35, 0.1, 0.7), 0.12, 0.4, (0.45, 0.35, 0.28), 8))
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = "city"
    export_glb(OUT / "city.glb", [o])
    print("city tris", len(o.data.polygons))


def make_fog_lamp():
    reset()
    float_ = add_cyl("buoy_float", (0, 0, 0.15), 0.35, 0.25, (0.55, 0.4, 0.2), 10)
    pole = add_cyl("buoy_pole", (0, 0, 0.55), 0.06, 0.7, (0.35, 0.3, 0.25), 8)
    lamp = add_cyl("buoy_lamp", (0, 0, 1.0), 0.18, 0.28, (0.9, 0.95, 0.92), 10)
    glow = add_cyl("buoy_glow", (0, 0, 1.0), 0.08, 0.12, (0.85, 0.25, 0.18), 8)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (float_, pole, lamp, glow):
        o.select_set(True)
    bpy.context.view_layer.objects.active = float_
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = "fog_lamp"
    export_glb(OUT / "fog-lamp.glb", [o])
    print("fog_lamp tris", len(o.data.polygons))


def make_road():
    reset()
    plank = add_box("road", (0, 0, 0.04), (1.2, 0.28, 0.08), (0.45, 0.32, 0.18))
    # end caps
    a = add_box("road_a", (-0.55, 0, 0.06), (0.12, 0.32, 0.1), (0.4, 0.28, 0.15))
    b = add_box("road_b", (0.55, 0, 0.06), (0.12, 0.32, 0.1), (0.4, 0.28, 0.15))
    bpy.ops.object.select_all(action="DESELECT")
    for o in (plank, a, b):
        o.select_set(True)
    bpy.context.view_layer.objects.active = plank
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = "road"
    export_glb(OUT / "road.glb", [o])
    print("road tris", len(o.data.polygons))


if __name__ == "__main__":
    make_sheep()
    make_settlement()
    make_city()
    make_fog_lamp()
    make_road()
    print("DONE", OUT)

"""G3D-21 props: dock, boats×2, dice, tray, map frame. blender --background --python ..."""
import bpy, math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/models"
OUT.mkdir(parents=True, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def shade_flat(obj):
    for p in obj.data.polygons: p.use_smooth=False

def mat(name, color):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bsdf=m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value=(*color,1)
        bsdf.inputs["Roughness"].default_value=0.65
    return m

def box(name, loc, scale, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.active_object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat(name+"_m", color)); shade_flat(o); return o

def cyl(name, loc, r, d, color, v=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=loc)
    o=bpy.context.active_object; o.name=name
    o.data.materials.append(mat(name+"_m", color)); shade_flat(o); return o

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.object.join(); o=bpy.context.active_object; o.name=name; return o

def export(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.export_scene.gltf(filepath=str(path), use_selection=True, export_format='GLB', export_apply=True, export_materials='NONE')

def dock():
    reset()
    parts=[box('dock_deck',(0,0,0.15),(2.0,0.6,0.08),(0.45,0.32,0.18))]
    for i,x in enumerate((-0.8,-0.3,0.3,0.8)):
        parts.append(cyl(f'pill{i}',(x,0,-0.15),0.08,0.5,(0.35,0.25,0.15),6))
    o=join(parts,'dock'); export(OUT/'dock.glb',[o]); print('dock',len(o.data.polygons))

def boat(name, scale=1.0):
    reset()
    hull=box('hull',(0,0,0.15),(1.2*scale,0.45*scale,0.25*scale),(0.4,0.28,0.18))
    prow=box('prow',(0.7*scale,0,0.2),(0.35*scale,0.35*scale,0.2*scale),(0.42,0.3,0.2))
    mast=cyl('mast',(0,0,0.7*scale),0.04*scale,1.0*scale,(0.35,0.28,0.2),6)
    sail=box('sail',(0.05*scale,0.15*scale,0.75*scale),(0.05*scale,0.55*scale,0.7*scale),(0.9,0.9,0.85))
    o=join([hull,prow,mast,sail], name); export(OUT/f'{name}.glb',[o]); print(name,len(o.data.polygons))

def dice():
    reset()
    d=box('dice',(0,0,0.2),(0.4,0.4,0.4),(0.92,0.9,0.85))
    # pips as tiny spheres approx boxes
    pips=[]
    for i,loc in enumerate([(-0.12,-0.12,0.41),(0.12,0.12,0.41),(0,0,0.41)]):
        pips.append(box(f'pip{i}',loc,(0.06,0.06,0.02),(0.1,0.1,0.1)))
    o=join([d]+pips,'dice'); export(OUT/'dice.glb',[o]); print('dice',len(o.data.polygons))

def tray():
    reset()
    base=box('tray_base',(0,0,0.05),(1.2,0.8,0.08),(0.4,0.28,0.16))
    walls=[]
    for name,loc,sc in [
        ('tw',(0,0.38,0.12),(1.2,0.06,0.16)),('bw',(0,-0.38,0.12),(1.2,0.06,0.16)),
        ('lw',(-0.58,0,0.12),(0.06,0.8,0.16)),('rw',(0.58,0,0.12),(0.06,0.8,0.16))]:
        walls.append(box(name,loc,sc,(0.38,0.26,0.14)))
    o=join([base]+walls,'dice_tray'); export(OUT/'dice-tray.glb',[o]); print('tray',len(o.data.polygons))

def frame():
    reset()
    # straight + corner
    straight=box('frame_straight',(0,0,0.05),(1.5,0.12,0.1),(0.35,0.25,0.15))
    export(OUT/'frame-straight.glb',[straight])
    reset()
    a=box('fc_a',(0.4,0,0.05),(0.9,0.12,0.1),(0.35,0.25,0.15))
    b=box('fc_b',(0,0.4,0.05),(0.12,0.9,0.1),(0.35,0.25,0.15))
    o=join([a,b],'frame_corner'); export(OUT/'frame-corner.glb',[o]); print('frame ok')

if __name__=='__main__':
    dock(); boat('boat-a',1.0); boat('boat-b',0.85); dice(); tray(); frame()
    print('DONE')

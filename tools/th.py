"""Помощники для описания заданий (используются только при сборке data/tasks.json)."""

def R(x, y, w, h, c="land"):
    return {"t": "rect", "x": x, "y": y, "w": w, "h": h, "c": c}

def Z(id, label, x, y, w, h, c="land"):
    return {"t": "zone", "id": id, "label": label, "x": x, "y": y, "w": w, "h": h, "c": c}

def A(x1, y1, x2, y2, label=""):
    return {"t": "arrow", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "label": label}

def P(x, y, label):
    return {"t": "dot", "x": x, "y": y, "label": label}

def T(x, y, s):
    return {"t": "text", "x": x, "y": y, "s": s}

def D(items, vb="0 0 300 180", compass=True):
    return {"viewBox": vb, "compass": compass, "items": items}

def task(id, sec, typ, topic, title, desc, q, hint, expl, opts=None, ans=None,
         diagram=None, extra=False, complex_=False):
    t = {"id": id, "sectorId": sec, "type": typ, "topic": topic, "title": title,
         "description": desc, "question": q, "hint": hint, "explanation": expl,
         "extra": extra, "complex": complex_}
    if typ == "map_click":
        t["correctZone"] = ans
    else:
        t["options"] = opts
        t["correctAnswer"] = ans
    if diagram:
        t["diagram"] = diagram
    return t

MC, ID, AN, MAP = "multiple_choice", "identify", "analysis", "map_click"

"""Помощники для описания заданий (используются только при сборке data/tasks.json)."""

def R(x, y, w, h, c="land"):
    return {"t": "rect", "x": x, "y": y, "w": w, "h": h, "c": c}

def Z(id, label, x, y, w, h, c="land"):
    return {"t": "zone", "id": id, "label": label, "x": x, "y": y, "w": w, "h": h, "c": c}

def A(x1, y1, x2, y2, label=""):
    return {"t": "arrow", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "label": label}

def P(x, y, label):
    return {"t": "dot", "x": x, "y": y, "label": label}

def T(x, y, s, a=None, sm=False):
    t = {"t": "text", "x": x, "y": y, "s": s}
    if a: t["a"] = a
    if sm: t["sm"] = True
    return t

def L(pts, c="temp"):
    """Ломаная линия: pts — список (x, y)."""
    return {"t": "line", "pts": " ".join("%s,%s" % (x, y) for x, y in pts), "c": c}

def climatogram(temps, precs, tk=3.2, pk=0.35):
    """Климатограмма: столбики — осадки (мм), линия — температура (°C). Шкалы: t*tk и p*pk пикселей."""
    x0, x1, base = 30, 268, 150
    step = (x1 - x0) / 12.0
    items = [R(0, 0, 300, 180, "card")]
    for t in (10, 20, 30):
        y = round(base - t * tk, 1)
        items += [L([(x0, y), (x1, y)], "axis"), T(x0 - 3, y + 3, "%d°" % t, a="end", sm=True)]
    for p in (100, 200):
        y = round(base - p * pk, 1)
        items.append(T(x1 + 3, y + 3, str(p), a="start", sm=True))
    for i, p in enumerate(precs):
        h = round(p * pk, 1)
        items.append(R(round(x0 + i * step + 3, 1), round(base - h, 1), round(step - 6, 1), h, "prec"))
    items.append(L([(round(x0 + i * step + step / 2, 1), round(base - t * tk, 1)) for i, t in enumerate(temps)], "temp"))
    items.append(L([(x0, base), (x1, base)], "axis"))
    for i, m in enumerate("ЯФМАМИИАСОНД"):
        items.append(T(round(x0 + i * step + step / 2, 1), base + 12, m, sm=True))
    items += [T(78, 12, "Линия: температура, °C", sm=True), T(205, 12, "Столбики: осадки, мм", sm=True)]
    return D(items, "0 0 300 180", compass=False)

def D(items, vb="0 0 300 180", compass=True):
    return {"viewBox": vb, "compass": compass, "items": items}

def task(id, sec, typ, topic, title, desc, q, hint, expl, opts=None, ans=None,
         diagram=None, extra=False, complex_=False, fgos=None):
    t = {"id": id, "sectorId": sec, "type": typ, "topic": topic, "title": title,
         "description": desc, "question": q, "hint": hint, "explanation": expl,
         "extra": extra, "complex": complex_}
    if fgos:
        t["fgos"] = fgos
    if typ == "map_click":
        t["correctZone"] = ans
    else:
        t["options"] = opts
        t["correctAnswer"] = ans
    if diagram:
        t["diagram"] = diagram
    return t

MC, ID, AN, MAP = "multiple_choice", "identify", "analysis", "map_click"

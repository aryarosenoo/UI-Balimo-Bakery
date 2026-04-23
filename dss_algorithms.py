"""
=============================================================================
DSS MANAJEMEN INVENTORY — IMPLEMENTASI ALGORITMA (Python)
=============================================================================
Berisi implementasi penuh untuk:
  1. MPS  — Master Production Schedule
  2. MRP  — Material Requirements Planning
  3. RCCP — Rough-Cut Capacity Planning
  4. CRP  — Capacity Requirements Planning

Cara menjalankan:
  python dss_algorithms.py

Cara import ke proyek lain:
  from dss_algorithms import runDSS, DEMO_CONFIG
=============================================================================
"""

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# =============================================================================
# SECTION 1 — STRUKTUR DATA (Dataclasses)
# =============================================================================

@dataclass
class Product:
    """Produk jadi yang dijadwalkan produksinya."""
    id:           str
    name:         str
    safety_stock: int    # Stok pengaman minimum (unit)
    lot_size:     int    # Ukuran lot produksi (unit)
    init_stock:   int    # Stok awal sebelum periode pertama (unit)


@dataclass
class Component:
    """Komponen / bahan baku yang dikelola MRP."""
    id:           str
    name:         str
    lead_time:    int    # Lead time pemesanan (jumlah periode)
    lot_size:     int    # Ukuran lot pemesanan (unit)
    safety_stock: int    # Stok pengaman komponen (unit)
    init_stock:   int    # Stok awal (unit)


@dataclass
class BOMEntry:
    """Satu baris Bill of Material: komponen X dibutuhkan sebanyak Y per unit produk Z."""
    component_id: str
    product_id:   str
    coefficient:  float  # Jumlah komponen per unit produk


@dataclass
class WorkCenter:
    """Work center / mesin produksi."""
    id:                  str
    name:                str
    capacity_per_week:   float  # Kapasitas jam per minggu
    efficiency:          float  # Efisiensi mesin (0–1)
    max_utilization:     float  # Batas utilisasi maksimum (0–1)


@dataclass
class RoutingEntry:
    """Waktu proses satu produk di satu work center."""
    product_id:     str
    work_center_id: str
    hours_per_unit: float  # Jam mesin per unit produk


@dataclass
class MPSResult:
    product_id: str
    demand:     List[int]
    production: List[int]
    on_hand:    List[int]


@dataclass
class MRPResult:
    component_id:      str
    gross_requirement: List[int]
    scheduled_receipt: List[int]
    projected_on_hand: List[int]
    net_requirement:   List[int]
    planned_order:     List[int]
    planned_release:   List[int]   # PO yang harus dirilis (dimajukan lead time)


@dataclass
class RCCPResult:
    work_center_id:     str
    load:               List[float]
    available_capacity: List[float]
    utilization_pct:    List[float]
    overloaded:         List[bool]


@dataclass
class CRPResult:
    work_center_id:    str
    load:              List[float]
    effective_capacity:List[float]
    utilization_pct:   List[float]
    overloaded:        List[bool]


@dataclass
class DSSConfig:
    """Konfigurasi lengkap sistem DSS."""
    n_periods:    int
    products:     List[Product]
    components:   List[Component]
    bom:          List[BOMEntry]
    work_centers: List[WorkCenter]
    routing:      List[RoutingEntry]
    demand_map:   Dict[str, List[int]]  # { product_id: [demand per periode] }


@dataclass
class DSSSummary:
    total_production: Dict[str, int]
    purchase_orders:  List[dict]
    wc_summary:       List[dict]
    rccp_warnings:    List[str]


# =============================================================================
# SECTION 2 — HELPER / UTILITAS
# =============================================================================

def round_up_to_lot(qty: float, lot_size: int) -> int:
    """
    Membulatkan qty ke atas ke kelipatan lot_size terdekat.

    Contoh:
        round_up_to_lot(130, 50) → 150
        round_up_to_lot(50, 50)  → 50
        round_up_to_lot(0, 50)   → 0
    """
    if qty <= 0:
        return 0
    return math.ceil(qty / lot_size) * lot_size


def zeros(n: int) -> List[int]:
    """Membuat list berisi n elemen bernilai 0."""
    return [0] * n


def zeros_float(n: int) -> List[float]:
    """Membuat list float berisi n elemen bernilai 0.0."""
    return [0.0] * n


def validate_non_negative(arr: list, label: str) -> None:
    """Validasi semua elemen array adalah angka non-negatif."""
    for i, v in enumerate(arr):
        if not isinstance(v, (int, float)) or v < 0:
            raise ValueError(f"{label}[{i}] harus non-negatif, ditemukan: {v}")


# =============================================================================
# SECTION 3 — ALGORITMA MPS (Master Production Schedule)
# =============================================================================

def calc_mps(
    demand:       List[int],
    init_stock:   int,
    safety_stock: int,
    lot_size:     int,
) -> tuple[List[int], List[int]]:
    """
    Menghitung Master Production Schedule untuk satu produk.

    LOGIKA (per periode t):
      temp = on_hand_sebelumnya - demand[t]

      Jika temp < safety_stock:
        deficit    = safety_stock - temp
        produksi   = round_up_to_lot(deficit, lot_size)
        on_hand[t] = temp + produksi

      Jika temp >= safety_stock:
        produksi   = 0
        on_hand[t] = temp

    Args:
        demand       : List demand per periode
        init_stock   : Stok awal sebelum periode pertama
        safety_stock : Stok pengaman minimum
        lot_size     : Ukuran lot produksi

    Returns:
        (production, on_hand) — masing-masing list sepanjang n_periods

    Contoh:
        production, on_hand = calc_mps([50,60,70], 80, 20, 50)
    """
    # Validasi
    if not demand:
        raise ValueError("demand tidak boleh kosong")
    validate_non_negative(demand, "demand")
    if init_stock < 0:
        raise ValueError("init_stock tidak boleh negatif")
    if safety_stock < 0:
        raise ValueError("safety_stock tidak boleh negatif")
    if lot_size <= 0:
        raise ValueError("lot_size harus > 0")

    n          = len(demand)
    production = zeros(n)
    on_hand    = zeros(n)

    current_stock = init_stock

    for t in range(n):
        # Proyeksi stok setelah memenuhi demand, sebelum keputusan produksi
        projected = current_stock - demand[t]

        if projected < safety_stock:
            # Stok tidak cukup → jadwalkan produksi
            deficit       = safety_stock - projected
            production[t] = round_up_to_lot(deficit, lot_size)
            current_stock = projected + production[t]
        else:
            # Stok masih aman → tidak perlu produksi
            production[t] = 0
            current_stock = projected

        on_hand[t] = max(0, current_stock)

    return production, on_hand


def run_mps(
    products:   List[Product],
    demand_map: Dict[str, List[int]],
) -> Dict[str, MPSResult]:
    """
    Menjalankan MPS untuk semua produk.

    Returns:
        Dict { product_id → MPSResult }
    """
    results = {}

    for product in products:
        demand = demand_map.get(product.id)
        if demand is None:
            raise KeyError(f'Demand untuk produk "{product.id}" tidak ditemukan')

        production, on_hand = calc_mps(
            demand,
            product.init_stock,
            product.safety_stock,
            product.lot_size,
        )

        results[product.id] = MPSResult(
            product_id=product.id,
            demand=list(demand),
            production=production,
            on_hand=on_hand,
        )

    return results


# =============================================================================
# SECTION 4 — ALGORITMA MRP (Material Requirements Planning)
# =============================================================================

def calc_mrp_component(
    gross_req:         List[int],
    scheduled_receipt: List[int],
    init_stock:        int,
    safety_stock:      int,
    lot_size:          int,
    lead_time:         int,
) -> MRPResult:
    """
    Menghitung MRP untuk satu komponen.

    LOGIKA (per periode t):
      1. after_receipt = on_hand_sebelumnya + scheduled_receipt[t]
      2. net_req[t]    = max(0, gross_req[t] - after_receipt + safety_stock)
      3. Jika net_req[t] > 0:
           planned_order[t] = round_up_to_lot(net_req[t], lot_size)
      4. on_hand[t] = max(0, after_receipt + planned_order[t] - gross_req[t])
      5. planned_release[t - lead_time] = planned_order[t]
         (jika t - lead_time < 0 → PO sudah harus dikirim sebelum horizon)

    Args:
        gross_req         : Kebutuhan kotor per periode (dari BOM × MPS)
        scheduled_receipt : Penerimaan yang sudah terjadwal sebelumnya
        init_stock        : Stok awal komponen
        safety_stock      : Stok pengaman
        lot_size          : Ukuran lot pemesanan
        lead_time         : Lead time pemesanan (jumlah periode)

    Returns:
        MRPResult
    """
    validate_non_negative(gross_req,         "gross_req")
    validate_non_negative(scheduled_receipt, "scheduled_receipt")
    if init_stock < 0:   raise ValueError("init_stock tidak boleh negatif")
    if safety_stock < 0: raise ValueError("safety_stock tidak boleh negatif")
    if lot_size <= 0:    raise ValueError("lot_size harus > 0")
    if lead_time < 0:    raise ValueError("lead_time tidak boleh negatif")

    n               = len(gross_req)
    net_req         = zeros(n)
    planned_order   = zeros(n)
    planned_release = zeros(n)
    proj_on_hand    = zeros(n)

    prev_on_hand = init_stock

    for t in range(n):
        # Stok setelah penerimaan terjadwal
        after_receipt = prev_on_hand + scheduled_receipt[t]

        # Kebutuhan bersih: kekurangan stok untuk memenuhi demand + safety stock
        raw_net   = gross_req[t] - after_receipt + safety_stock
        net_req[t] = max(0, raw_net)

        if net_req[t] > 0:
            planned_order[t] = round_up_to_lot(net_req[t], lot_size)

        # Proyeksi stok akhir periode ini
        proj_on_hand[t] = max(0, after_receipt + planned_order[t] - gross_req[t])
        prev_on_hand    = proj_on_hand[t]

        # Planned release: PO harus dirilis lead_time periode sebelumnya
        if planned_order[t] > 0:
            release_at = t - lead_time
            if release_at >= 0:
                planned_release[release_at] += planned_order[t]
            # release_at < 0 → past due (PO sudah harus dirilis sebelum horizon)

    return MRPResult(
        component_id="",          # diisi oleh run_mrp
        gross_requirement=list(gross_req),
        scheduled_receipt=list(scheduled_receipt),
        projected_on_hand=proj_on_hand,
        net_requirement=net_req,
        planned_order=planned_order,
        planned_release=planned_release,
    )


def calc_gross_requirements(
    bom:         List[BOMEntry],
    mps_results: Dict[str, MPSResult],
    n_periods:   int,
) -> Dict[str, List[int]]:
    """
    Menghitung gross requirement semua komponen dari hasil MPS.

    Rumus:
        gross_req[komponen][t] = Σ_produk (mps.production[produk][t] × BOM_coef)

    Returns:
        Dict { component_id → gross_req[] }
    """
    gross_map: Dict[str, List[int]] = {}

    for entry in bom:
        if entry.component_id not in gross_map:
            gross_map[entry.component_id] = zeros(n_periods)

        mps = mps_results.get(entry.product_id)
        if mps is None:
            continue

        for t in range(n_periods):
            gross_map[entry.component_id][t] += int(
                mps.production[t] * entry.coefficient
            )

    return gross_map


def run_mrp(
    components:  List[Component],
    bom:         List[BOMEntry],
    mps_results: Dict[str, MPSResult],
    n_periods:   int,
) -> Dict[str, MRPResult]:
    """
    Menjalankan MRP untuk semua komponen.

    Returns:
        Dict { component_id → MRPResult }
    """
    gross_map = calc_gross_requirements(bom, mps_results, n_periods)
    results   = {}

    for comp in components:
        gross_req         = gross_map.get(comp.id, zeros(n_periods))
        scheduled_receipt = zeros(n_periods)  # bisa diisi dari data PO existing

        result = calc_mrp_component(
            gross_req,
            scheduled_receipt,
            comp.init_stock,
            comp.safety_stock,
            comp.lot_size,
            comp.lead_time,
        )
        result.component_id = comp.id
        results[comp.id]    = result

    return results


# =============================================================================
# SECTION 5 — ALGORITMA RCCP (Rough-Cut Capacity Planning)
# =============================================================================

def run_rccp(
    work_centers: List[WorkCenter],
    routing:      List[RoutingEntry],
    mps_results:  Dict[str, MPSResult],
    n_periods:    int,
) -> Dict[str, RCCPResult]:
    """
    Menghitung RCCP untuk semua work center berdasarkan MPS.

    LOGIKA (per WC per periode t):
      beban[t]    = Σ_produk (mps.production[produk][t] × routing_time[produk][WC])
      kapasitas   = capacity_per_week × efficiency × max_utilization
      utilisasi   = beban[t] / kapasitas × 100%
      overloaded  = utilisasi > 100

    Returns:
        Dict { work_center_id → RCCPResult }
    """
    results = {}

    for wc in work_centers:
        # Kapasitas tersedia per periode (konstan)
        avail_cap = wc.capacity_per_week * wc.efficiency * wc.max_utilization

        load              = zeros_float(n_periods)
        available_capacity= [avail_cap] * n_periods
        utilization_pct   = zeros_float(n_periods)
        overloaded        = [False] * n_periods

        # Akumulasi beban dari setiap rute produk → WC ini
        for route in routing:
            if route.work_center_id != wc.id:
                continue
            mps = mps_results.get(route.product_id)
            if mps is None:
                continue
            for t in range(n_periods):
                load[t] += mps.production[t] * route.hours_per_unit

        # Hitung utilisasi dan flag overload
        for t in range(n_periods):
            if avail_cap > 0:
                utilization_pct[t] = round(load[t] / avail_cap * 100, 1)
            overloaded[t] = utilization_pct[t] > 100

        results[wc.id] = RCCPResult(
            work_center_id=wc.id,
            load=[round(v, 2) for v in load],
            available_capacity=available_capacity,
            utilization_pct=utilization_pct,
            overloaded=overloaded,
        )

    return results


def get_rccp_overloads(rccp_results: Dict[str, RCCPResult]) -> List[dict]:
    """
    Mengembalikan daftar periode yang overload di RCCP.

    Returns:
        List[{ wc_id, period, utilization_pct }]
    """
    overloads = []
    for wc_id, result in rccp_results.items():
        for t, is_over in enumerate(result.overloaded):
            if is_over:
                overloads.append({
                    "wc_id":           wc_id,
                    "period":          t + 1,
                    "utilization_pct": result.utilization_pct[t],
                })
    return overloads


# =============================================================================
# SECTION 6 — ALGORITMA CRP (Capacity Requirements Planning)
# =============================================================================

def run_crp(
    work_centers: List[WorkCenter],
    routing:      List[RoutingEntry],
    mps_results:  Dict[str, MPSResult],
    n_periods:    int,
) -> Dict[str, CRPResult]:
    """
    Menghitung CRP — kapasitas detail berdasarkan work order dari MRP/MPS.

    Perbedaan dari RCCP:
      - Kapasitas efektif = capacity_per_week × efficiency
        (TANPA dikalikan max_utilization)
      - Menampilkan utilisasi sesungguhnya terhadap kapasitas fisik penuh
      - Lebih konservatif / realistis sebagai dasar keputusan

    LOGIKA (per WC per periode t):
      beban[t]           = Σ_produk (mps.production[produk][t] × routing_time)
      kapasitas_efektif  = capacity_per_week × efficiency
      utilisasi[t]       = beban[t] / kapasitas_efektif × 100%

    Returns:
        Dict { work_center_id → CRPResult }
    """
    results = {}

    for wc in work_centers:
        # Kapasitas efektif: jam × efisiensi (tanpa potongan utilisasi maks)
        eff_cap = wc.capacity_per_week * wc.efficiency

        load               = zeros_float(n_periods)
        effective_capacity = [eff_cap] * n_periods
        utilization_pct    = zeros_float(n_periods)
        overloaded         = [False] * n_periods

        for route in routing:
            if route.work_center_id != wc.id:
                continue
            mps = mps_results.get(route.product_id)
            if mps is None:
                continue
            for t in range(n_periods):
                load[t] += mps.production[t] * route.hours_per_unit

        for t in range(n_periods):
            if eff_cap > 0:
                utilization_pct[t] = round(load[t] / eff_cap * 100, 1)
            overloaded[t] = utilization_pct[t] > 100

        results[wc.id] = CRPResult(
            work_center_id=wc.id,
            load=[round(v, 2) for v in load],
            effective_capacity=effective_capacity,
            utilization_pct=utilization_pct,
            overloaded=overloaded,
        )

    return results


# =============================================================================
# SECTION 7 — ORKESTRASI (Pipeline Lengkap DSS)
# =============================================================================

def run_dss(config: DSSConfig) -> dict:
    """
    Menjalankan seluruh pipeline DSS secara berurutan:
        MPS → RCCP (cek kapasitas) → MRP → CRP → Ringkasan

    Args:
        config: DSSConfig — konfigurasi lengkap sistem

    Returns:
        {
          "mps":            Dict[str, MPSResult],
          "mrp":            Dict[str, MRPResult],
          "rccp":           Dict[str, RCCPResult],
          "crp":            Dict[str, CRPResult],
          "rccp_overloads": List[dict],
          "summary":        DSSSummary,
        }
    """
    print("=" * 60)
    print("  DSS MANAJEMEN INVENTORY — MULAI PERHITUNGAN")
    print("=" * 60)

    # --- Langkah 1: MPS ---
    print("\n▶ Langkah 1: Menghitung MPS...")
    mps_results = run_mps(config.products, config.demand_map)
    print(f"  ✓ MPS selesai untuk {len(mps_results)} produk.")

    # --- Langkah 2: RCCP ---
    print("\n▶ Langkah 2: Menghitung RCCP (verifikasi kapasitas kasar)...")
    rccp_results  = run_rccp(config.work_centers, config.routing, mps_results, config.n_periods)
    rccp_overloads = get_rccp_overloads(rccp_results)

    if rccp_overloads:
        print(f"  ⚠ Ditemukan {len(rccp_overloads)} periode overload:")
        for o in rccp_overloads:
            print(f"    → {o['wc_id']} periode M{o['period']}: {o['utilization_pct']}%")
        print("    Pertimbangkan revisi MPS (reschedule / tambah kapasitas).")
    else:
        print("  ✓ Semua kapasitas dalam batas aman.")

    # --- Langkah 3: MRP ---
    print("\n▶ Langkah 3: Menghitung MRP...")
    mrp_results = run_mrp(config.components, config.bom, mps_results, config.n_periods)
    print(f"  ✓ MRP selesai untuk {len(mrp_results)} komponen.")

    # --- Langkah 4: CRP ---
    print("\n▶ Langkah 4: Menghitung CRP (kapasitas detail)...")
    crp_results = run_crp(config.work_centers, config.routing, mps_results, config.n_periods)
    print(f"  ✓ CRP selesai untuk {len(crp_results)} work center.")

    # --- Langkah 5: Ringkasan ---
    summary = build_summary(mps_results, mrp_results, rccp_results, crp_results, config.components)

    print("\n✓ Semua perhitungan selesai.\n")
    return {
        "mps":            mps_results,
        "mrp":            mrp_results,
        "rccp":           rccp_results,
        "crp":            crp_results,
        "rccp_overloads": rccp_overloads,
        "summary":        summary,
    }


def build_summary(
    mps_results:  Dict[str, MPSResult],
    mrp_results:  Dict[str, MRPResult],
    rccp_results: Dict[str, RCCPResult],
    crp_results:  Dict[str, CRPResult],
    components:   List[Component],
) -> DSSSummary:
    """Membangun ringkasan keputusan dari semua hasil model."""

    # Total produksi per produk
    total_production = {
        pid: sum(r.production)
        for pid, r in mps_results.items()
    }

    # Purchase order yang perlu dibuat (planned_release > 0)
    comp_map = {c.id: c for c in components}
    purchase_orders = []
    for comp_id, r in mrp_results.items():
        comp = comp_map.get(comp_id)
        for t, qty in enumerate(r.planned_release):
            if qty > 0:
                receive_week = t + 1 + (comp.lead_time if comp else 0)
                purchase_orders.append({
                    "component_id": comp_id,
                    "release_week": t + 1,
                    "receive_week": receive_week,
                    "qty":          qty,
                })

    # Ringkasan utilisasi per WC (dari CRP)
    wc_summary = []
    for wc_id, r in crp_results.items():
        avg_util   = round(sum(r.utilization_pct) / len(r.utilization_pct), 1)
        max_util   = max(r.utilization_pct)
        over_count = sum(r.overloaded)
        wc_summary.append({
            "wc_id":         wc_id,
            "avg_util_pct":  avg_util,
            "max_util_pct":  max_util,
            "overload_count": over_count,
        })

    # Warning dari RCCP
    rccp_warnings = [
        f"{wc_id} M{t + 1}: {r.utilization_pct[t]}%"
        for wc_id, r in rccp_results.items()
        for t, is_over in enumerate(r.overloaded)
        if is_over
    ]

    return DSSSummary(
        total_production=total_production,
        purchase_orders=purchase_orders,
        wc_summary=wc_summary,
        rccp_warnings=rccp_warnings,
    )


# =============================================================================
# SECTION 8 — DATA CONTOH
# =============================================================================

DEMO_CONFIG = DSSConfig(
    n_periods=16,

    products=[
        Product(id="PA", name="Produk A", safety_stock=20, lot_size=50, init_stock=80),
        Product(id="PB", name="Produk B", safety_stock=20, lot_size=50, init_stock=60),
        Product(id="PC", name="Produk C", safety_stock=20, lot_size=50, init_stock=40),
    ],

    components=[
        Component(id="CA", name="Komponen A", lead_time=2, lot_size=100, safety_stock=50, init_stock=450),
        Component(id="CB", name="Komponen B", lead_time=3, lot_size=150, safety_stock=30, init_stock=120),
        Component(id="CC", name="Komponen C", lead_time=2, lot_size=200, safety_stock=40, init_stock=60),
        Component(id="CD", name="Komponen D", lead_time=1, lot_size=100, safety_stock=20, init_stock=300),
    ],

    bom=[
        BOMEntry(component_id="CA", product_id="PA", coefficient=2),
        BOMEntry(component_id="CA", product_id="PB", coefficient=1),
        BOMEntry(component_id="CA", product_id="PC", coefficient=3),
        BOMEntry(component_id="CB", product_id="PA", coefficient=1),
        BOMEntry(component_id="CB", product_id="PB", coefficient=3),
        BOMEntry(component_id="CB", product_id="PC", coefficient=2),
        BOMEntry(component_id="CC", product_id="PA", coefficient=3),
        BOMEntry(component_id="CC", product_id="PB", coefficient=2),
        BOMEntry(component_id="CC", product_id="PC", coefficient=1),
        BOMEntry(component_id="CD", product_id="PA", coefficient=2),
        BOMEntry(component_id="CD", product_id="PB", coefficient=2),
        BOMEntry(component_id="CD", product_id="PC", coefficient=2),
    ],

    work_centers=[
        WorkCenter(id="WC1", name="Work Center 1", capacity_per_week=80, efficiency=0.90, max_utilization=0.85),
        WorkCenter(id="WC2", name="Work Center 2", capacity_per_week=80, efficiency=0.90, max_utilization=0.85),
        WorkCenter(id="WC3", name="Work Center 3", capacity_per_week=60, efficiency=0.90, max_utilization=0.85),
        WorkCenter(id="WC4", name="Work Center 4", capacity_per_week=60, efficiency=0.90, max_utilization=0.85),
    ],

    routing=[
        RoutingEntry(product_id="PA", work_center_id="WC1", hours_per_unit=0.5),
        RoutingEntry(product_id="PA", work_center_id="WC2", hours_per_unit=0.3),
        RoutingEntry(product_id="PA", work_center_id="WC3", hours_per_unit=0.4),
        RoutingEntry(product_id="PA", work_center_id="WC4", hours_per_unit=0.2),
        RoutingEntry(product_id="PB", work_center_id="WC1", hours_per_unit=0.4),
        RoutingEntry(product_id="PB", work_center_id="WC2", hours_per_unit=0.5),
        RoutingEntry(product_id="PB", work_center_id="WC3", hours_per_unit=0.2),
        RoutingEntry(product_id="PB", work_center_id="WC4", hours_per_unit=0.3),
        RoutingEntry(product_id="PC", work_center_id="WC1", hours_per_unit=0.3),
        RoutingEntry(product_id="PC", work_center_id="WC2", hours_per_unit=0.2),
        RoutingEntry(product_id="PC", work_center_id="WC3", hours_per_unit=0.5),
        RoutingEntry(product_id="PC", work_center_id="WC4", hours_per_unit=0.4),
    ],

    demand_map={
        "PA": [50, 60, 55, 70, 65, 80, 75, 90, 85, 100,  95, 110, 105, 120, 115, 130],
        "PB": [40, 45, 50, 45, 55, 60, 65, 70, 75,  80,  85,  90,  95, 100, 105, 110],
        "PC": [30, 35, 40, 35, 45, 50, 55, 60, 65,  70,  75,  80,  85,  90,  95, 100],
    },
)


# =============================================================================
# SECTION 9 — ENTRY POINT & CETAK HASIL
# =============================================================================

def print_separator(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print('=' * 60)


def print_results(output: dict) -> None:
    weeks = [f"M{i+1}" for i in range(16)]
    header = f"  {'Periode':<14}" + "".join(f"{w:>6}" for w in weeks)

    # MPS
    print_separator("HASIL MPS")
    for pid, r in output["mps"].items():
        print(f"\n  {pid}:")
        print(header)
        print(f"  {'Demand':<14}" + "".join(f"{v:>6}" for v in r.demand))
        print(f"  {'Produksi':<14}" + "".join(f"{v:>6}" for v in r.production))
        print(f"  {'On-Hand':<14}" + "".join(f"{v:>6}" for v in r.on_hand))

    # MRP
    print_separator("HASIL MRP")
    for cid, r in output["mrp"].items():
        total_po = sum(r.planned_order)
        print(f"\n  {cid}  (Total PO: {total_po} unit):")
        print(header)
        print(f"  {'Gross Req':<14}" + "".join(f"{v:>6}" for v in r.gross_requirement))
        print(f"  {'On-Hand':<14}" + "".join(f"{v:>6}" for v in r.projected_on_hand))
        print(f"  {'Net Req':<14}" + "".join(f"{v:>6}" for v in r.net_requirement))
        print(f"  {'Planned PO':<14}" + "".join(f"{v:>6}" for v in r.planned_order))
        print(f"  {'PO Release':<14}" + "".join(f"{v:>6}" for v in r.planned_release))

    # RCCP
    print_separator("HASIL RCCP")
    for wid, r in output["rccp"].items():
        over = sum(r.overloaded)
        print(f"\n  {wid}  (Overload: {over} periode):")
        print(header)
        print(f"  {'Utilisasi':<14}" + "".join(f"{v:>5}%" for v in r.utilization_pct))

    # CRP
    print_separator("HASIL CRP")
    for wid, r in output["crp"].items():
        over = sum(r.overloaded)
        avg  = round(sum(r.utilization_pct) / len(r.utilization_pct), 1)
        print(f"\n  {wid}  (Avg: {avg}%, Overload: {over} periode):")
        print(header)
        print(f"  {'Beban (jam)':<14}" + "".join(f"{v:>6}" for v in r.load))
        print(f"  {'Utilisasi':<14}" + "".join(f"{v:>5}%" for v in r.utilization_pct))

    # Ringkasan
    print_separator("RINGKASAN KEPUTUSAN")
    s = output["summary"]

    print("\n  Total produksi per produk:")
    for pid, qty in s.total_production.items():
        print(f"    {pid}: {qty:,} unit")

    print("\n  Purchase orders yang perlu dibuat:")
    if s.purchase_orders:
        for po in s.purchase_orders:
            print(f"    {po['component_id']}: {po['qty']:>4} unit "
                  f"— release M{po['release_week']}, "
                  f"terima M{po['receive_week']}")
    else:
        print("    Tidak ada PO yang diperlukan.")

    print("\n  Ringkasan utilisasi work center (CRP):")
    for w in s.wc_summary:
        flag = " ⚠ OVERLOAD" if w["overload_count"] > 0 else " ✓"
        print(f"    {w['wc_id']}: avg {w['avg_util_pct']}%, "
              f"max {w['max_util_pct']}%, "
              f"overload {w['overload_count']} periode{flag}")

    if s.rccp_warnings:
        print(f"\n  ⚠ RCCP Warnings ({len(s.rccp_warnings)} periode):")
        for w in s.rccp_warnings:
            print(f"    → {w}")
    else:
        print("\n  ✓ Tidak ada peringatan kapasitas dari RCCP.")

    print()


if __name__ == "__main__":
    output = run_dss(DEMO_CONFIG)
    print_results(output)

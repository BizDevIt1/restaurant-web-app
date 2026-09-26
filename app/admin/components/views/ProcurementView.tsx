"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Package,
  RefreshCw,
  FileText,
  Printer,
  Eye,
  Check,
  Clock,
  XCircle,
  Building2,
  Phone,
  Mail,
  Calendar,
  Layers,
  ArrowRight,
  PackageCheck,
  ChevronDown,
} from "lucide-react";
import { Supplier, PurchaseOrder, PurchaseOrderItem, RawMaterial } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import GRNModal, { ReceivedItemInspection } from "./GRNModal";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface ProcurementViewProps {
  showToast: (msg: string) => void;
}

const SUPPLIER_CATEGORIES = [
  "Meat",
  "Dairy",
  "Produce",
  "Packaging",
  "Spices",
  "Bakery",
  "Beverages",
  "General",
] as const;

const PAYMENT_TERMS = [
  "Cash on Delivery",
  "Net 15",
  "Net 30",
  "Net 60",
  "Advance Payment",
] as const;

export default function ProcurementView({ showToast }: ProcurementViewProps) {
  const { user } = useAuth();

  // Primary State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<"pos" | "suppliers">("pos");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Modals State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [viewingPo, setViewingPo] = useState<PurchaseOrder | null>(null);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isInwardingStock, setIsInwardingStock] = useState(false);

  // Creatable Dropdowns State
  const [isCustomSupCategory, setIsCustomSupCategory] = useState(false);
  const [isCustomSupPaymentTerms, setIsCustomSupPaymentTerms] = useState(false);

  // Supplier Form State
  const [supName, setSupName] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supCategory, setSupCategory] = useState<string>("Meat");
  const [supPaymentTerms, setSupPaymentTerms] = useState<string>("Cash on Delivery");
  const [supIsActive, setSupIsActive] = useState(true);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Create PO Form State
  const [poSupplierId, setPoSupplierId] = useState<string>("");
  const [poSupplierName, setPoSupplierName] = useState<string>("");
  const [poExpectedDelivery, setPoExpectedDelivery] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([
    { name: "", unit: "kg", unit_price: 0, quantity: 1, subtotal: 0 },
  ]);
  const [isCreatingPo, setIsCreatingPo] = useState(false);

  // Fetch Data strictly from Supabase
  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const poCacheKey = `backup_purchase_orders_${restId}`;

      // 1. Fetch Suppliers
      const { data: supData, error: supErr } = await supabase
        .from("suppliers")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (supErr) {
        console.warn("[ProcurementView] Failed to fetch suppliers:", supErr.message);
      } else if (supData) {
        setSuppliers(supData);
      }

      // 2. Fetch Purchase Orders with reliable Supabase query
      const { data: poData, error: poErr } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (poErr) {
        console.warn("[ProcurementView] Failed to fetch POs:", poErr.message);
        try {
          const cached = localStorage.getItem(poCacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) setPurchaseOrders(parsed);
          }
        } catch { }
      } else if (poData) {
        setPurchaseOrders(poData);
        try {
          localStorage.setItem(poCacheKey, JSON.stringify(poData));
        } catch { }
      }

      // 3. Fetch Raw Materials for PO item picker
      const { data: rmData, error: rmErr } = await supabase
        .from("raw_materials")
        .select("*")
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      if (!rmErr && rmData) {
        setRawMaterials(rmData);
      }

      if (isManual) {
        showToast("Procurement records refreshed.");
      }
    } catch (err) {
      console.error("[ProcurementView] Load error:", err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Quick Stats Computations (3 Cards)
  const activeOrdersCount = useMemo(() => {
    return purchaseOrders.filter((po) => po.status === "PENDING" || po.status === "APPROVED").length;
  }, [purchaseOrders]);

  const totalProcurementSpend = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return purchaseOrders
      .filter((po) => {
        if (po.status !== "RECEIVED") return false;
        if (!po.created_at) return true;
        const d = new Date(po.created_at);
        return isNaN(d.getTime()) || (d.getMonth() === currentMonth && d.getFullYear() === currentYear);
      })
      .reduce((sum, po) => sum + Number(po.total_cost || 0), 0);
  }, [purchaseOrders]);

  const activeSuppliersCount = useMemo(() => {
    return suppliers.filter((s) => s.is_active).length;
  }, [suppliers]);

  // Dynamically extract categories from standard presets + any custom categories added in suppliers
  const availableCategories = useMemo(() => {
    const cats = new Set<string>(SUPPLIER_CATEGORIES);
    suppliers.forEach((s) => {
      if (s.category && s.category.trim()) {
        cats.add(s.category.trim());
      }
    });
    return Array.from(cats);
  }, [suppliers]);

  // Dynamically extract payment terms from standard presets + any custom terms added in suppliers
  const availablePaymentTerms = useMemo(() => {
    const terms = new Set<string>(PAYMENT_TERMS);
    suppliers.forEach((s) => {
      if (s.payment_terms && s.payment_terms.trim()) {
        terms.add(s.payment_terms.trim());
      }
    });
    return Array.from(terms);
  }, [suppliers]);

  // Filtered POs
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchStatus = statusFilter === "ALL" || po.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        po.po_number.toLowerCase().includes(q) ||
        po.supplier_name.toLowerCase().includes(q) ||
        (po.notes && po.notes.toLowerCase().includes(q)) ||
        (Array.isArray(po.items) && po.items.some((i) => i.name.toLowerCase().includes(q)));
      return matchStatus && matchSearch;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchCat = categoryFilter === "ALL" || s.category === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(q) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [suppliers, categoryFilter, searchQuery]);

  // Open Add Supplier Modal
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupName("");
    setSupContact("");
    setSupPhone("");
    setSupEmail("");
    setSupCategory("Meat");
    setSupPaymentTerms("Cash on Delivery");
    setIsCustomSupCategory(false);
    setIsCustomSupPaymentTerms(false);
    setSupIsActive(true);
    setIsSupplierModalOpen(true);
  };

  // Open Edit Supplier Modal
  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupName(supplier.name);
    setSupContact(supplier.contact_person || "");
    setSupPhone(supplier.phone || "");
    setSupEmail(supplier.email || "");
    const cat = supplier.category || "Meat";
    const terms = supplier.payment_terms || "Cash on Delivery";
    setSupCategory(cat);
    setSupPaymentTerms(terms);
    setIsCustomSupCategory(!SUPPLIER_CATEGORIES.includes(cat as any));
    setIsCustomSupPaymentTerms(!PAYMENT_TERMS.includes(terms as any));
    setSupIsActive(supplier.is_active ?? true);
    setIsSupplierModalOpen(true);
  };

  // Save Supplier (Create or Update)
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      showToast("Supplier name is required.");
      return;
    }

    setIsSavingSupplier(true);
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);

      if (editingSupplier) {
        // Update
        const updatedItem: Supplier = {
          ...editingSupplier,
          name: supName.trim(),
          contact_person: supContact.trim() || undefined,
          phone: supPhone.trim() || undefined,
          email: supEmail.trim() || undefined,
          category: supCategory,
          payment_terms: supPaymentTerms,
          is_active: supIsActive,
          updated_at: new Date().toISOString(),
        };

        setSuppliers((prev) =>
          prev.map((s) => (s.id === editingSupplier.id ? updatedItem : s))
        );
        setIsSupplierModalOpen(false);
        showToast(`Updated "${supName.trim()}".`);

        const { error } = await supabase
          .from("suppliers")
          .update({
            name: supName.trim(),
            contact_person: supContact.trim() || null,
            phone: supPhone.trim() || null,
            email: supEmail.trim() || null,
            category: supCategory,
            payment_terms: supPaymentTerms,
            is_active: supIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSupplier.id);

        if (error) console.warn("[ProcurementView] Supabase supplier update error:", error.message);
      } else {
        // Create
        const tempId = Date.now();
        const newItem: Supplier = {
          id: tempId,
          restaurant_id: restId,
          branch_id: branchId || null,
          name: supName.trim(),
          contact_person: supContact.trim() || undefined,
          phone: supPhone.trim() || undefined,
          email: supEmail.trim() || undefined,
          category: supCategory,
          payment_terms: supPaymentTerms,
          is_active: supIsActive,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setSuppliers((prev) => [newItem, ...prev]);
        setIsSupplierModalOpen(false);
        showToast(`Added "${supName.trim()}".`);

        const { data, error } = await supabase
          .from("suppliers")
          .insert([
            {
              restaurant_id: restId,
              branch_id: branchId || null,
              name: supName.trim(),
              contact_person: supContact.trim() || null,
              phone: supPhone.trim() || null,
              email: supEmail.trim() || null,
              category: supCategory,
              payment_terms: supPaymentTerms,
              is_active: supIsActive,
            },
          ])
          .select()
          .single();

        if (error) {
          console.warn("[ProcurementView] Supabase supplier insert error:", error.message);
        } else if (data) {
          setSuppliers((prev) =>
            prev.map((s) => (s.id === tempId ? { ...s, id: data.id } : s))
          );
        }
      }
    } catch (err) {
      console.error("[ProcurementView] Supplier save error:", err);
      showToast("Error saving supplier details.");
    } finally {
      setIsSavingSupplier(false);
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    const target = supplierToDelete;
    setSupplierToDelete(null);

    setSuppliers((prev) => prev.filter((s) => s.id !== target.id));
    showToast(`Removed "${target.name}".`);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("suppliers").delete().eq("id", target.id);
      if (error) console.warn("[ProcurementView] Supabase supplier delete error:", error.message);
    } catch (err) {
      console.error("[ProcurementView] Supplier delete error:", err);
    }
  };

  // Open Create PO Modal
  const handleOpenCreatePo = () => {
    const firstActiveSupplier = suppliers.find((s) => s.is_active);
    setPoSupplierId(firstActiveSupplier ? String(firstActiveSupplier.id) : "");
    setPoSupplierName(firstActiveSupplier ? firstActiveSupplier.name : "");
    setPoExpectedDelivery(new Date(Date.now() + 86400000).toISOString().split("T")[0]);
    setPoNotes("");
    setPoItems([{ name: "", unit: "kg", unit_price: 0, quantity: 1, subtotal: 0 }]);
    setIsCreatePoModalOpen(true);
  };

  // Add Row in PO Modal
  const handleAddPoItemRow = () => {
    setPoItems((prev) => [
      ...prev,
      { name: "", unit: "kg", unit_price: 0, quantity: 1, subtotal: 0 },
    ]);
  };

  // Remove Row in PO Modal
  const handleRemovePoItemRow = (index: number) => {
    if (poItems.length <= 1) return;
    setPoItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update Item in PO Modal
  const handleUpdatePoItem = (
    index: number,
    field: keyof PurchaseOrderItem,
    value: any
  ) => {
    setPoItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === "raw_material_id") {
        const matched = rawMaterials.find((rm) => String(rm.id) === String(value));
        if (matched) {
          item.name = matched.name;
          item.unit = matched.unit;
          item.unit_price = Number(matched.cost_per_unit || 0);
        }
      }

      if (field === "unit_price" || field === "quantity" || field === "raw_material_id") {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        item.subtotal = qty * price;
      }

      updated[index] = item;
      return updated;
    });
  };

  // Computed PO Total
  const poCalculatedTotal = useMemo(() => {
    return poItems.reduce((sum, itm) => sum + (Number(itm.subtotal) || 0), 0);
  }, [poItems]);

  // Submit Create PO
  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendorName = (poSupplierName || "").trim();
    if (!vendorName) {
      showToast("Please enter or select a vendor / supplier.");
      return;
    }

    const validItems = poItems.filter((itm) => itm.name.trim().length > 0 && itm.quantity > 0);
    if (validItems.length === 0) {
      showToast("Please add at least one valid item with name and quantity.");
      return;
    }

    setIsCreatingPo(true);
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      const poCacheKey = `backup_purchase_orders_${restId}`;

      // 1. Check if supplier already exists in suppliers (case-insensitive match)
      let matchedSupplier = suppliers.find(
        (s) =>
          s.name.trim().toLowerCase() === vendorName.toLowerCase() ||
          String(s.id) === String(poSupplierId)
      );

      // 2. If NEW vendor: automatically insert into public.suppliers so it permanently registers for future POs
      if (!matchedSupplier) {
        try {
          const { data: newSupData, error: newSupErr } = await supabase
            .from("suppliers")
            .insert([
              {
                restaurant_id: restId,
                branch_id: branchId || null,
                name: vendorName,
                category: "General",
                payment_terms: "Cash on Delivery",
                is_active: true,
              },
            ])
            .select()
            .single();

          if (!newSupErr && newSupData) {
            matchedSupplier = newSupData;
            setSuppliers((prev) => [newSupData, ...prev]);
          } else if (newSupErr) {
            console.warn("[ProcurementView] Auto-insert new supplier error:", newSupErr.message);
          }
        } catch (supErr) {
          console.warn("[ProcurementView] Supplier auto-creation exception:", supErr);
        }
      }

      const supNameSelected = matchedSupplier ? matchedSupplier.name : vendorName;
      const validSupplierId = matchedSupplier ? Number(matchedSupplier.id) : null;

      const generatedPoNumber = `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(3, "0")}`;
      const tempId = Date.now();

      const newPo: PurchaseOrder = {
        id: tempId,
        restaurant_id: restId,
        branch_id: branchId || null,
        po_number: generatedPoNumber,
        supplier_id: validSupplierId ?? undefined,
        supplier_name: supNameSelected,
        status: "PENDING",
        total_cost: poCalculatedTotal,
        items: validItems,
        notes: poNotes.trim() || undefined,
        expected_delivery: poExpectedDelivery || undefined,
        created_by: user?.name || "Admin",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setPurchaseOrders((prev) => {
        const nextList = [newPo, ...prev];
        try {
          localStorage.setItem(poCacheKey, JSON.stringify(nextList));
        } catch { }
        return nextList;
      });
      setIsCreatePoModalOpen(false);
      showToast(`Created PO ${generatedPoNumber} for ${supNameSelected}.`);

      const insertPayload = {
        restaurant_id: restId,
        branch_id: branchId || null,
        po_number: generatedPoNumber,
        supplier_id: validSupplierId,
        supplier_name: supNameSelected,
        status: "PENDING",
        total_cost: poCalculatedTotal,
        items: validItems,
        notes: poNotes.trim() || null,
        expected_delivery: poExpectedDelivery || null,
        created_by: user?.name || "Admin",
      };

      let { data, error } = await supabase
        .from("purchase_orders")
        .insert([insertPayload])
        .select()
        .single();

      // If failed on foreign key constraint, retry with supplier_id: null
      if (error && validSupplierId !== null) {
        console.warn("[ProcurementView] Retrying PO insert without supplier_id FK:", error.message);
        const retry = await supabase
          .from("purchase_orders")
          .insert([{ ...insertPayload, supplier_id: null }])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.warn("[ProcurementView] Supabase PO insert error:", error.message);
      } else if (data) {
        setPurchaseOrders((prev) => {
          const updated = prev.map((po) => (po.id === tempId ? { ...po, id: data.id } : po));
          try {
            localStorage.setItem(poCacheKey, JSON.stringify(updated));
          } catch { }
          return updated;
        });
      }
    } catch (err) {
      console.error("[ProcurementView] Create PO error:", err);
      showToast("Error creating purchase order.");
    } finally {
      setIsCreatingPo(false);
    }
  };

  // Quick Status Updater
  const handleUpdatePoStatus = async (
    po: PurchaseOrder,
    nextStatus: "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED"
  ) => {
    // If attempting to receive, route through the dedicated GRN verification modal
    if (nextStatus === "RECEIVED") {
      handleOpenGrnModal(po);
      return;
    }

    // Optimistic update
    setPurchaseOrders((prev) => {
      const updated = prev.map((item) => (item.id === po.id ? { ...item, status: nextStatus } : item));
      try {
        if (po.restaurant_id) {
          localStorage.setItem(`backup_purchase_orders_${po.restaurant_id}`, JSON.stringify(updated));
        }
      } catch { }
      return updated;
    });

    if (viewingPo && viewingPo.id === po.id) {
      setViewingPo({ ...viewingPo, status: nextStatus });
    }

    showToast(`PO ${po.po_number} marked as ${nextStatus}.`);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", po.id);

      if (error) console.warn("[ProcurementView] Supabase PO status update error:", error.message);
    } catch (err) {
      console.error("[ProcurementView] Status update error:", err);
    }
  };

  // Open GRN Modal
  const handleOpenGrnModal = (po: PurchaseOrder) => {
    setReceivingPo(po);
    setIsGrnModalOpen(true);
  };

  // Confirm GRN and Execute Inward Stock Increment
  const handleConfirmGrn = async (
    po: PurchaseOrder,
    inspectedItems: ReceivedItemInspection[],
    challanNumber: string,
    receiverNotes: string
  ) => {
    // 1. Prevent Duplicate Receiving: Ensure only POs with status !== 'RECEIVED' can trigger stock increment
    if (po.status === "RECEIVED") {
      showToast("This purchase order has already been received and inwarded.");
      return;
    }

    setIsInwardingStock(true);
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      const poCacheKey = `backup_purchase_orders_${restId}`;

      // 2. Execute Inward Stock Increment in public.raw_materials
      const updatedMaterialsMap = new Map<number | string, { current_stock: number; cost_per_unit: number }>();

      for (const item of inspectedItems) {
        const receivedQty = Number(item.received_quantity) || 0;
        if (receivedQty <= 0) continue;

        let targetRmId: number | null = null;
        let currentStock = 0;
        let costPerUnit = 0;

        // 1. Try matching by raw_material_id in Supabase
        if (item.raw_material_id && !isNaN(Number(item.raw_material_id))) {
          const { data: dbRm } = await supabase
            .from("raw_materials")
            .select("id, current_stock, cost_per_unit")
            .eq("id", Number(item.raw_material_id))
            .single();
          if (dbRm) {
            targetRmId = dbRm.id;
            currentStock = Number(dbRm.current_stock || 0);
            costPerUnit = Number(dbRm.cost_per_unit || 0);
          }
        }

        // 2. Fallback: match by name in Supabase
        if (!targetRmId && item.name) {
          const { data: nameRms } = await supabase
            .from("raw_materials")
            .select("id, current_stock, cost_per_unit")
            .eq("restaurant_id", restId)
            .ilike("name", item.name.trim())
            .limit(1);

          if (nameRms && nameRms.length > 0) {
            targetRmId = nameRms[0].id;
            currentStock = Number(nameRms[0].current_stock || 0);
            costPerUnit = Number(nameRms[0].cost_per_unit || 0);
          }
        }

        // 3. Fallback: check local rawMaterials state
        if (!targetRmId) {
          const localMatch = rawMaterials.find(
            (rm) => rm.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (localMatch && !isNaN(Number(localMatch.id))) {
            const { data: dbRm } = await supabase
              .from("raw_materials")
              .select("id, current_stock, cost_per_unit")
              .eq("id", Number(localMatch.id))
              .single();
            if (dbRm) {
              targetRmId = dbRm.id;
              currentStock = Number(dbRm.current_stock || 0);
              costPerUnit = Number(dbRm.cost_per_unit || 0);
            }
          }
        }

        if (targetRmId) {
          // Increment existing stock
          const newStock = currentStock + receivedQty;
          const newCost = Number(item.unit_price) > 0 ? Number(item.unit_price) : costPerUnit;

          const { error: rmErr } = await supabase
            .from("raw_materials")
            .update({
              current_stock: newStock,
              cost_per_unit: newCost,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetRmId);

          if (rmErr) {
            console.warn(`[ProcurementView] Stock update error for material ${targetRmId}:`, rmErr.message);
          } else {
            updatedMaterialsMap.set(targetRmId, { current_stock: newStock, cost_per_unit: newCost });
          }
        } else {
          // Material not yet in database: auto-insert new record into public.raw_materials
          const newCost = Number(item.unit_price) || 0;
          const { data: insertedRm, error: insertErr } = await supabase
            .from("raw_materials")
            .insert([
              {
                restaurant_id: restId,
                branch_id: branchId || null,
                name: item.name.trim(),
                category: "General",
                unit: item.unit || "kg",
                current_stock: receivedQty,
                min_safety_stock: 5,
                cost_per_unit: newCost,
              },
            ])
            .select()
            .single();

          if (insertErr) {
            console.warn(`[ProcurementView] Failed to auto-insert raw material ${item.name}:`, insertErr.message);
          } else if (insertedRm) {
            setRawMaterials((prev) => [insertedRm, ...prev]);
            updatedMaterialsMap.set(insertedRm.id, { current_stock: receivedQty, cost_per_unit: newCost });
          }
        }
      }

      // Optimistically update local raw materials state so inventory tabs reflect inwarded balances immediately
      if (updatedMaterialsMap.size > 0) {
        setRawMaterials((prev) =>
          prev.map((rm) => {
            const updated = updatedMaterialsMap.get(rm.id);
            return updated ? { ...rm, current_stock: updated.current_stock, cost_per_unit: updated.cost_per_unit } : rm;
          })
        );
      }

      // 3. Update Purchase Order Status to RECEIVED with delivery challan & notes
      const deliveryDetails = [
        challanNumber ? `Challan #${challanNumber}` : "",
        receiverNotes ? receiverNotes : "",
      ].filter(Boolean).join(" - ");

      const deliveryNote = deliveryDetails || "Stock verified & inwarded via GRN";
      const finalNotes = po.notes
        ? `${po.notes} | Received: ${deliveryNote}`
        : `Received: ${deliveryNote}`;

      const revisedTotalCost = inspectedItems.reduce(
        (sum, itm) => sum + (Number(itm.received_quantity) || 0) * (Number(itm.unit_price) || 0),
        0
      );

      const { error: poErr } = await supabase
        .from("purchase_orders")
        .update({
          status: "RECEIVED",
          notes: finalNotes,
          total_cost: revisedTotalCost > 0 ? revisedTotalCost : po.total_cost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", po.id);

      if (poErr) {
        console.warn("[ProcurementView] PO status update error:", poErr.message);
      }

      // 4. Optimistic UI Update & Local Cache Sync
      const updatedPos = purchaseOrders.map((item) =>
        item.id === po.id
          ? {
            ...item,
            status: "RECEIVED" as const,
            notes: finalNotes,
            total_cost: revisedTotalCost > 0 ? revisedTotalCost : item.total_cost,
            updated_at: new Date().toISOString(),
          }
          : item
      );
      setPurchaseOrders(updatedPos);
      try {
        localStorage.setItem(poCacheKey, JSON.stringify(updatedPos));
      } catch { }

      if (viewingPo && viewingPo.id === po.id) {
        setViewingPo({
          ...viewingPo,
          status: "RECEIVED",
          notes: finalNotes,
          total_cost: revisedTotalCost > 0 ? revisedTotalCost : viewingPo.total_cost,
        });
      }

      setIsGrnModalOpen(false);
      setReceivingPo(null);
      showToast("Stock successfully inwarded. Inventory balances updated.");
    } catch (err) {
      console.error("[ProcurementView] Error inwarding stock:", err);
      showToast("Error processing GRN stock inward.");
    } finally {
      setIsInwardingStock(false);
    }
  };

  // Delete Purchase Order
  const handleDeletePo = async () => {
    if (!poToDelete) return;
    const target = poToDelete;
    setPoToDelete(null);

    setPurchaseOrders((prev) => {
      const nextList = prev.filter((p) => p.id !== target.id);
      try {
        if (target.restaurant_id) {
          localStorage.setItem(`backup_purchase_orders_${target.restaurant_id}`, JSON.stringify(nextList));
        }
      } catch { }
      return nextList;
    });
    showToast(`Deleted ${target.po_number}.`);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("purchase_orders").delete().eq("id", target.id);
      if (error) console.warn("[ProcurementView] PO delete error:", error.message);
    } catch (err) {
      console.error("[ProcurementView] Delete PO error:", err);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* A. TOP BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
            <Truck className="w-3.5 h-3.5" />
            <span>PROCUREMENT &amp; SUPPLY CHAIN</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Procurement{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Hub
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Manage verified suppliers, issue purchase orders, and monitor vendor deliverables
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === "pos" ? (
            <button
              type="button"
              onClick={handleOpenCreatePo}
              className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
            >
              <Plus className="w-4 h-4" />
              <span>Create PO</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddSupplier}
              className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* B. QUICK STATS BANNER (COMPACT, 3 CARDS ONLY) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 font-mono">
        {/* Card 1: Active Orders */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[11px] font-bold border border-[var(--gold)]/30">
              In-Flight POs
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
              {activeOrdersCount}
              <span className="text-xs sm:text-sm font-normal text-[var(--text-faint)] ml-1.5">active</span>
            </div>
            <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
              Pending &amp; Approved Purchase Orders
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Awaiting Inward GRN</span>
            <span className="text-[var(--gold)]">In Transit</span>
          </div>
        </div>

        {/* Card 2: Total Procurement Spend */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[11px] font-bold border border-[var(--gold)]/30">
              Total Spend
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--gold)] tracking-tight">
              Rs {totalProcurementSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
              Total Procurement Spend
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Settled vendor bills</span>
            <span className="text-[var(--gold)]">Stock Inwarded</span>
          </div>
        </div>

        {/* Card 3: Active Suppliers */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#25d366]/15 border border-[#25d366]/30 flex items-center justify-center text-[#25d366] shrink-0 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] font-mono text-[11px] font-bold border border-[#25d366]/30">
              Active Fleet
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[#25d366] tracking-tight">
              {activeSuppliersCount}
              <span className="text-xs sm:text-sm font-normal text-[#25d366]/80 ml-1.5">registered</span>
            </div>
            <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
              Active Verified Suppliers
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Vendor network directory</span>
            <span className="text-[#25d366]">Supply Chain Ready</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* C. SUB-NAVIGATION TABS & SEARCH/FILTERS */}
      {/* ========================================================================= */}
      {/* Unified Navigation Dropdown, Filter & Search Bar in a Single Horizontal Row */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full border-b border-[var(--border)] pb-3">
        {/* Navigation Tab Dropdown (styled identically to search bar) */}
        <div className="relative w-[44%] sm:w-56 shrink-0">
          <ResponsiveSelect
            value={activeTab}
            onChange={(val) => setActiveTab(val as "pos" | "suppliers")}
            buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
            menuClassName="w-56"
            options={[
              { id: "pos", label: "Purchase Orders", count: purchaseOrders.length },
              { id: "suppliers", label: "Suppliers Directory", count: suppliers.length },
            ]}
          />
        </div>

        {/* Secondary Filter Dropdown (Status or Category) */}
        {activeTab === "pos" ? (
          <div className="relative hidden sm:block w-40 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] text-xs font-mono rounded-xl pl-3 pr-8 py-2.5 h-10 focus:outline-none transition-all shadow-inner cursor-pointer"
            >
              <option value="ALL" className="bg-[#1a1400] text-[var(--text-hi)]">All Statuses</option>
              <option value="PENDING" className="bg-[#1a1400] text-[var(--text-hi)]">Pending</option>
              <option value="APPROVED" className="bg-[#1a1400] text-[var(--text-hi)]">Approved</option>
              <option value="RECEIVED" className="bg-[#1a1400] text-[var(--text-hi)]">Received</option>
              <option value="CANCELLED" className="bg-[#1a1400] text-[var(--text-hi)]">Cancelled</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        ) : (
          <div className="relative hidden sm:block w-44 shrink-0">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] text-xs font-mono rounded-xl pl-3 pr-8 py-2.5 h-10 focus:outline-none transition-all shadow-inner cursor-pointer"
            >
              <option value="ALL" className="bg-[#1a1400] text-[var(--text-hi)]">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c} className="bg-[#1a1400] text-[var(--text-hi)]">
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        )}

        {/* Live Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "pos" ? "Search POs, vendors, items..." : "Search suppliers, phone..."}
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-3 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* D. TAB CONTENT */}
      {/* ========================================================================= */}
      {activeTab === "pos" ? (
        /* PURCHASE ORDERS TABLE */
        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[var(--text-faint)] uppercase text-[10px] tracking-wider font-semibold font-mono">
                  <th className="py-3.5 px-4">PO Number</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Items Summary</th>
                  <th className="py-3.5 px-4">Delivery Date</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white tracking-wide mb-4">No purchase orders found</h3>
                        <button
                          type="button"
                          onClick={handleOpenCreatePo}
                          className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create PO</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredPurchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white tracking-wide">No matching purchase orders</h3>
                        <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">Try adjusting your status filter or search term.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPurchaseOrders.map((po) => {
                    const itemsArr = Array.isArray(po.items) ? po.items : [];
                    const itemsSummary = itemsArr
                      .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
                      .join(", ");

                    return (
                      <tr
                        key={po.id}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="py-3 px-4 font-bold text-[var(--gold)]">
                          {po.po_number}
                          <span className="block text-[10px] text-[var(--text-faint)] font-normal">
                            {po.created_at ? new Date(po.created_at).toLocaleDateString() : "Today"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-[var(--text-hi)]">
                          {po.supplier_name}
                        </td>
                        <td className="py-3 px-4 max-w-[280px] truncate text-[var(--text-lo)] font-sans" title={itemsSummary}>
                          <span className="font-mono text-[11px] text-[var(--text-faint)] mr-1">
                            [{itemsArr.length} items]
                          </span>
                          {itemsSummary || "No items listed"}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-lo)]">
                          {po.expected_delivery || "Immediate"}
                        </td>
                        <td className="py-3 px-4 font-bold text-[var(--text-hi)]">
                          Rs {Number(po.total_cost || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${po.status === "PENDING"
                                ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                                : po.status === "APPROVED"
                                  ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                                  : po.status === "RECEIVED"
                                    ? "bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366]"
                                    : "bg-red-500/15 border border-red-500/30 text-red-400"
                              }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {po.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* 1. Status Specific Quick Action Buttons */}
                            {po.status === "PENDING" && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePoStatus(po, "APPROVED")}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-[11px] font-bold font-mono transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm hover:scale-[1.02]"
                                  title="Approve Purchase Order"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve PO</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGrnModal(po)}
                                  className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] transition-colors cursor-pointer"
                                  title="Direct Stock Inward (GRN)"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {po.status === "APPROVED" && (
                              <button
                                type="button"
                                onClick={() => handleOpenGrnModal(po)}
                                className="btn-gold animate-sheen px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:scale-[1.02] transition-transform"
                                title="Inspect and inward stock to inventory balances"
                              >
                                <PackageCheck className="w-3.5 h-3.5 text-[#1a1400]" />
                                <span>Receive Stock</span>
                              </button>
                            )}

                            {po.status === "RECEIVED" && (
                              <span
                                className="px-2.5 py-1 rounded-lg bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] text-[10px] font-bold font-mono inline-flex items-center gap-1.5 select-none"
                                title="Stock received and inwarded to inventory"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Received &amp; Inwarded</span>
                              </span>
                            )}

                            {po.status === "CANCELLED" && (
                              <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono">
                                Cancelled
                              </span>
                            )}

                            {/* View / Print Slip (Always accessible) */}
                            <button
                              type="button"
                              onClick={() => setViewingPo(po)}
                              className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] transition-colors cursor-pointer"
                              title="View & Print PO Slip"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete PO only if NOT received */}
                            {po.status !== "RECEIVED" && (
                              <button
                                type="button"
                                onClick={() => setPoToDelete(po)}
                                className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-red-500/20 text-[var(--text-lo)] hover:text-red-400 border border-[var(--border)] transition-colors cursor-pointer"
                                title="Delete PO"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* SUPPLIERS DIRECTORY TABLE */
        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[var(--text-faint)] uppercase text-[10px] tracking-wider font-semibold font-mono">
                  <th className="py-3.5 px-4">Supplier Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Phone &amp; Email</th>
                  <th className="py-3.5 px-4">Payment Terms</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white tracking-wide mb-4">No suppliers registered yet</h3>
                        <button
                          type="button"
                          onClick={handleOpenAddSupplier}
                          className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Supplier</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4">
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white tracking-wide">No matching suppliers</h3>
                        <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">Try adjusting your category filter or search query.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((sup) => (
                    <tr
                      key={sup.id}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="py-3 px-4 font-sans font-bold text-[var(--text-hi)]">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${sup.is_active ? "bg-[#25d366]" : "bg-zinc-600"
                              }`}
                          />
                          <span>{sup.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] text-[11px]">
                          {sup.category || "General"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-lo)] font-sans">
                        {sup.contact_person || "—"}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-lo)]">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {sup.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-[var(--text-faint)]" />
                              <span>{sup.phone}</span>
                            </div>
                          )}
                          {sup.email && (
                            <div className="flex items-center gap-1.5 text-[var(--text-faint)]">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[160px]">{sup.email}</span>
                            </div>
                          )}
                          {!sup.phone && !sup.email && "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-lo)]">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--gold-dim)] border border-[var(--gold)]/20 text-[var(--gold)] text-[10px] font-semibold">
                          {sup.payment_terms || "Cash on Delivery"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sup.is_active
                              ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                              : "bg-[var(--surface)] text-[var(--text-faint)] border border-[var(--border)]"
                            }`}
                        >
                          {sup.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSupplier(sup)}
                            className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] transition-colors cursor-pointer"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSupplierToDelete(sup)}
                            className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-red-500/20 text-[var(--text-lo)] hover:text-red-400 border border-[var(--border)] transition-colors cursor-pointer"
                            title="Delete Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT SUPPLIER */}
      {/* ========================================================================= */}
      {isSupplierModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSupplierModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-[var(--text-hi)]">
                    {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
                  </h3>
                  <p className="text-[11px] font-mono text-[var(--text-faint)]">
                    Vendor registry and payment terms configuration
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                  Supplier / Vendor Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Al-Madina Meat Supply"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[var(--text-lo)]">
                      Category
                    </label>
                    {isCustomSupCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSupCategory(false);
                          setSupCategory(SUPPLIER_CATEGORIES[0]);
                        }}
                        className="text-[11px] text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <X className="w-3 h-3" />
                        <span>Presets</span>
                      </button>
                    )}
                  </div>
                  {isCustomSupCategory ? (
                    <input
                      type="text"
                      autoFocus
                      value={supCategory}
                      onChange={(e) => setSupCategory(e.target.value)}
                      placeholder="Enter custom category"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    />
                  ) : (
                    <div className="relative">
                      <select
                        value={supCategory}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsCustomSupCategory(true);
                            setSupCategory("");
                          } else {
                            setSupCategory(e.target.value);
                          }
                        }}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                      >
                        {availableCategories.map((c) => (
                          <option key={c} value={c} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                            {c}
                          </option>
                        ))}
                        <option value="__custom__" className="bg-[var(--bg-deep)] text-[var(--gold)] font-bold">
                          + Custom Category...
                        </option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[var(--text-lo)]">
                      Payment Terms
                    </label>
                    {isCustomSupPaymentTerms && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSupPaymentTerms(false);
                          setSupPaymentTerms(PAYMENT_TERMS[0]);
                        }}
                        className="text-[11px] text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <X className="w-3 h-3" />
                        <span>Presets</span>
                      </button>
                    )}
                  </div>
                  {isCustomSupPaymentTerms ? (
                    <input
                      type="text"
                      autoFocus
                      value={supPaymentTerms}
                      onChange={(e) => setSupPaymentTerms(e.target.value)}
                      placeholder="e.g. Net 15 Days"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    />
                  ) : (
                    <div className="relative">
                      <select
                        value={supPaymentTerms}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsCustomSupPaymentTerms(true);
                            setSupPaymentTerms("");
                          } else {
                            setSupPaymentTerms(e.target.value);
                          }
                        }}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                      >
                        {availablePaymentTerms.map((t) => (
                          <option key={t} value={t} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                            {t}
                          </option>
                        ))}
                        <option value="__custom__" className="bg-[var(--bg-deep)] text-[var(--gold)] font-bold">
                          + Custom Payment Terms...
                        </option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="e.g. Tariq Mahmood"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="e.g. orders@supplier.com"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="supActive"
                  checked={supIsActive}
                  onChange={(e) => setSupIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--gold)] focus:ring-0 focus:outline-none cursor-pointer accent-[var(--gold)]"
                />
                <label htmlFor="supActive" className="text-xs text-[var(--text-hi)] font-medium cursor-pointer select-none">
                  Supplier is Active &amp; Verified for Procurement
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="btn-gold px-5 py-2.5 rounded-xl font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform disabled:opacity-50 text-xs"
                >
                  {isSavingSupplier ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{editingSupplier ? "Update Supplier" : "Save Supplier"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE PURCHASE ORDER */}
      {/* ========================================================================= */}
      {isCreatePoModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreatePoModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-[var(--text-hi)]">
                    Create Purchase Order
                  </h3>
                  <p className="text-[11px] font-mono text-[var(--text-faint)]">
                    Issue formal stock procurement order to vendor
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatePoModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            <form onSubmit={handleCreatePoSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Target Vendor / Supplier <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="po-suppliers-datalist"
                    value={poSupplierName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPoSupplierName(val);
                      const matched = suppliers.find(
                        (s) => s.name.trim().toLowerCase() === val.trim().toLowerCase()
                      );
                      setPoSupplierId(matched ? String(matched.id) : "");
                    }}
                    placeholder="Type or select a supplier..."
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                  <datalist id="po-suppliers-datalist">
                    {suppliers
                      .filter((s) => s.is_active)
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.category ? `${s.name} (${s.category})` : s.name}
                        </option>
                      ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poExpectedDelivery}
                    onChange={(e) => setPoExpectedDelivery(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none transition-all cursor-pointer font-sans"
                  />
                </div>
              </div>

              {/* Dynamic Line Items Section */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-xs font-semibold text-[var(--text-hi)]">
                    Procurement Line Items
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPoItemRow}
                    className="px-3 py-1.5 rounded-xl bg-[var(--gold-dim)] hover:bg-[var(--gold)]/25 text-[var(--gold)] border border-[var(--gold)]/30 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm font-sans"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {poItems.map((itm, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--border)] space-y-2.5 transition-all font-sans"
                    >
                      <div className="grid grid-cols-12 gap-2.5 items-center">
                        {/* Creatable Material Selector & Freeform Name */}
                        <div className="col-span-12 sm:col-span-5">
                          <input
                            type="text"
                            required
                            list={`po-items-datalist-${idx}`}
                            placeholder="Item name or inventory material..."
                            value={itm.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = rawMaterials.find(
                                (rm) => rm.name.trim().toLowerCase() === val.trim().toLowerCase()
                              );
                              if (matched) {
                                handleUpdatePoItem(idx, "raw_material_id", matched.id);
                                handleUpdatePoItem(idx, "name", matched.name);
                                handleUpdatePoItem(idx, "unit", matched.unit);
                                if (Number(matched.cost_per_unit) > 0 && !itm.unit_price) {
                                  handleUpdatePoItem(idx, "unit_price", Number(matched.cost_per_unit));
                                }
                              } else {
                                handleUpdatePoItem(idx, "raw_material_id", undefined);
                                handleUpdatePoItem(idx, "name", val);
                              }
                            }}
                            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                          />
                          <datalist id={`po-items-datalist-${idx}`}>
                            {rawMaterials.map((rm) => (
                              <option key={rm.id} value={rm.name}>
                                {rm.name} (Stock: {rm.current_stock} {rm.unit} | Rs {rm.cost_per_unit || 0})
                              </option>
                            ))}
                          </datalist>
                        </div>

                        {/* Unit */}
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="text"
                            list="po-units-list"
                            placeholder="Unit"
                            value={itm.unit}
                            onChange={(e) => handleUpdatePoItem(idx, "unit", e.target.value)}
                            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-2.5 py-2 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all text-center font-sans"
                          />
                          <datalist id="po-units-list">
                            <option value="kg" />
                            <option value="g" />
                            <option value="liters" />
                            <option value="ml" />
                            <option value="pcs" />
                            <option value="boxes" />
                            <option value="cans" />
                            <option value="packs" />
                          </datalist>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            placeholder="Qty"
                            value={itm.quantity || ""}
                            onChange={(e) =>
                              handleUpdatePoItem(idx, "quantity", parseFloat(e.target.value) || 0)
                            }
                            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-2.5 py-2 text-xs text-[var(--text-hi)] font-mono placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all text-right"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Rate (Rs)"
                            value={itm.unit_price || ""}
                            onChange={(e) =>
                              handleUpdatePoItem(idx, "unit_price", parseFloat(e.target.value) || 0)
                            }
                            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-2.5 py-2 text-xs text-[var(--text-hi)] font-mono placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all text-right"
                          />
                        </div>

                        {/* Delete row */}
                        <div className="col-span-2 sm:col-span-1 text-right">
                          <button
                            type="button"
                            disabled={poItems.length <= 1}
                            onClick={() => handleRemovePoItemRow(idx)}
                            className="p-2 rounded-xl text-[var(--text-faint)] hover:text-rose-400 hover:bg-rose-500/15 transition-colors disabled:opacity-25 cursor-pointer inline-flex items-center justify-center"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Row Subtotal */}
                      <div className="text-right text-xs font-mono text-[var(--text-faint)]">
                        Subtotal: <span className="font-bold text-[var(--gold)]">Rs {Number(itm.subtotal || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Bar */}
                <div className="p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--gold)]/30 flex items-center justify-between shadow-sm">
                  <span className="text-xs text-[var(--text-hi)] font-bold">
                    Total Estimated Amount:
                  </span>
                  <span className="text-xl font-black font-mono text-[var(--gold)]">
                    Rs {poCalculatedTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                  Special Delivery Instructions / Notes
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Deliver to rear loading bay before 11:00 AM..."
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl p-3.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsCreatePoModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPo}
                  className="btn-gold px-5 py-2.5 rounded-xl font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform disabled:opacity-50 text-xs"
                >
                  {isCreatingPo ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Generate Purchase Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW & PRINT PO SLIP */}
      {/* ========================================================================= */}
      {viewingPo && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingPo(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-3xl rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl p-5 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar font-mono text-[var(--text-hi)] animate-in zoom-in-95 duration-200">
            {/* Action Bar at Top */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4 print:hidden">
              <div className="inline-flex items-center gap-2 text-xs text-[var(--gold)] font-bold">
                <FileText className="w-4 h-4" />
                <span>OFFICIAL PURCHASE ORDER SLIP</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {viewingPo.status !== "RECEIVED" && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenGrnModal(viewingPo);
                    }}
                    className="btn-gold animate-sheen px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                    title="Open GRN Inspection & Inward Stock"
                  >
                    <PackageCheck className="w-3.5 h-3.5 text-[#1a1400]" />
                    <span>Receive Stock (GRN)</span>
                  </button>
                )}

                <select
                  value={viewingPo.status}
                  onChange={(e) =>
                    handleUpdatePoStatus(
                      viewingPo,
                      e.target.value as "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED"
                    )
                  }
                  className="bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--text-hi)] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[var(--gold)] cursor-pointer"
                  title="Update PO Status"
                >
                  <option value="PENDING">Status: PENDING</option>
                  <option value="APPROVED">Status: APPROVED</option>
                  <option value="RECEIVED">Status: RECEIVED</option>
                  <option value="CANCELLED">Status: CANCELLED</option>
                </select>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-hi)] border border-[var(--border)] transition-colors shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingPo(null)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div id="po-printable-slip" className="space-y-6">
              {/* Slip Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
                    {user?.restaurantName || "OmniBites Enterprise"}
                  </h2>
                  <p className="text-xs text-[var(--text-lo)] mt-0.5 font-sans">
                    {user?.address || "Main Operational Facility"}
                  </p>
                  <p className="text-xs text-[var(--text-lo)] font-sans">
                    Phone: {user?.phone || "+92 300 0000000"}
                  </p>
                </div>

                <div className="sm:text-right font-mono">
                  <div className="text-lg font-black text-[var(--gold)]">
                    {viewingPo.po_number}
                  </div>
                  <div className="text-xs text-[var(--text-lo)] mt-1">
                    Date: {viewingPo.created_at ? new Date(viewingPo.created_at).toLocaleDateString() : "Today"}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${viewingPo.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : viewingPo.status === "APPROVED"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                            : viewingPo.status === "RECEIVED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-red-500/20 text-red-300 border border-red-500/40"
                        }`}
                    >
                      {viewingPo.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vendor & Deliver-To Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--text-faint)] tracking-wider mb-1">
                    Vendor / Supplier
                  </div>
                  <div className="text-sm font-bold text-white font-sans">
                    {viewingPo.supplier_name}
                  </div>
                  <div className="text-[var(--text-lo)] mt-1">
                    Expected Delivery: {viewingPo.expected_delivery || "Immediate"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--text-faint)] tracking-wider mb-1">
                    Issue Details
                  </div>
                  <div className="text-[var(--text-lo)]">
                    Issued By: <span className="text-white font-semibold">{viewingPo.created_by || "Admin"}</span>
                  </div>
                  <div className="text-[var(--text-lo)] mt-1">
                    Order Ref: #{viewingPo.id}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-[var(--border)] rounded-2xl overflow-hidden glass-panel">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-[var(--border)] text-[var(--text-faint)] text-[10px] uppercase font-semibold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center">Unit</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/40">
                    {Array.isArray(viewingPo.items) && viewingPo.items.length > 0 ? (
                      viewingPo.items.map((item, i) => (
                        <tr key={i} className="text-zinc-300 hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 text-[var(--text-faint)]">{i + 1}</td>
                          <td className="py-2.5 px-3 font-sans font-medium text-white">{item.name}</td>
                          <td className="py-2.5 px-3 text-center text-[var(--text-lo)]">{item.unit}</td>
                          <td className="py-2.5 px-3 text-right">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right">Rs {Number(item.unit_price || 0).toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-white">
                            Rs {Number(item.subtotal || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-[var(--text-faint)]">
                          No items listed on this purchase order
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total & Notes */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="text-xs text-[var(--text-lo)] max-w-sm">
                  {viewingPo.notes && (
                    <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)]">
                      <span className="font-bold text-[var(--text-hi)] block mb-0.5">Notes:</span>
                      <span>{viewingPo.notes}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-right min-w-[200px]">
                  <div className="flex justify-between text-[var(--text-lo)]">
                    <span>Subtotal:</span>
                    <span>Rs {Number(viewingPo.total_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-lo)]">
                    <span>Sales Tax / Duty:</span>
                    <span>Rs 0</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-[var(--gold)] pt-1 border-t border-[var(--border)]">
                    <span>Total Net Payable:</span>
                    <span>Rs {Number(viewingPo.total_cost || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-[var(--border)] text-[11px] text-[var(--text-lo)]">
                <div>
                  <div className="border-b border-[var(--border)] w-40 mb-1" />
                  <span>Authorized Signature</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="border-b border-[var(--border)] w-40 mb-1" />
                  <span>Vendor Acknowledged</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODALS */}
      {/* ========================================================================= */}
      {supplierToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSupplierToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] p-5 sm:p-6 space-y-4 font-sans text-xs shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-[var(--text-hi)]">Delete Supplier?</h3>
            </div>
            <p className="text-[var(--text-lo)] font-mono">
              Are you sure you want to remove &quot;{supplierToDelete.name}&quot; from the verified directory?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] text-[var(--text-lo)] hover:bg-[var(--surface)] font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold cursor-pointer transition-all"
              >
                Delete Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {poToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPoToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] p-5 sm:p-6 space-y-4 font-sans text-xs shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-[var(--text-hi)]">Delete Purchase Order?</h3>
            </div>
            <p className="text-[var(--text-lo)] font-mono">
              Are you sure you want to delete purchase order &quot;{poToDelete.po_number}&quot;? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] text-[var(--text-lo)] hover:bg-[var(--surface)] font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePo}
                className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold cursor-pointer transition-all"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: GOODS RECEIVED NOTE (GRN) VERIFICATION & INWARD MODAL */}
      {/* ========================================================================= */}
      <GRNModal
        isOpen={isGrnModalOpen}
        po={receivingPo}
        rawMaterials={rawMaterials}
        onClose={() => {
          setIsGrnModalOpen(false);
          setReceivingPo(null);
        }}
        onConfirmInward={handleConfirmGrn}
        isSubmitting={isInwardingStock}
      />
    </div>
  );
}

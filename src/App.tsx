import * as XLSX from "xlsx";
import "./App.css";
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { db } from "./firebase";
import { collection, updateDoc, doc, onSnapshot, writeBatch, addDoc, deleteDoc, Timestamp, getDocs, } from "firebase/firestore";



interface Ingredient {
  id: string;
  name: string;
  weight: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  addedDate:      Date;
  expirationDate: Date;
  avgShelfLife: number;   
  pieceWeight?: number;   
}

interface FridgeItem {
  id: string;
  name: string;
  weight: number;
  addedDate: Date;
  expirationDate: Date;
}

const initialIngredientForm: Omit<Ingredient, "id"> = {
  name: "",
  weight: 0,
  calories: 0,
  carbs: 0,
  protein: 0,
  fat: 0,
  addedDate: new Date(),
  expirationDate: new Date(),
  avgShelfLife: 0,
  pieceWeight: 0,
};

interface RecipeIngredient {
  name: string;
  weight: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

interface Recipe {
  id: string
  name: string
  description?: string
  image?: string
  youtube?: string
  instagram?: string
  ingredients: RecipeIngredient[]
  total: {
    weight: number;
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
  };
}


function App() {

  
    // ─── App() 컴포넌트 안, useState 선언들 아래 ───
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
  
      // 1) 엑셀 읽어서 jsonData 생성 (기존 코드 유지)
      const dataStr = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () =>
          reader.result ? res(reader.result as string) : rej("읽기 실패");
        reader.readAsBinaryString(file);
      });
      const wb = XLSX.read(dataStr, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  
      // ───── A) 업로드 전에 기존 ingredients 컬렉션 비우기 ─────
      const existing = await getDocs(collection(db, "ingredients"));
      const deleteBatch = writeBatch(db);
      existing.docs.forEach(docSnap =>
        deleteBatch.delete(doc(db, "ingredients", docSnap.id))
      );
      await deleteBatch.commit();
      // ───────────────────────────────────────────────────────────
  
      // 2) Firestore에 새 데이터 배치 쓰기 (기존 코드 유지)
      const colRef = collection(db, "ingredients");
      const batch  = writeBatch(db);
      jsonData.forEach((row: any) => {
        if (!row.name || !row.weight) return;
        const docRef = doc(colRef);
        batch.set(docRef, {
          name:          row.name,
          weight:        Number(row.weight),
          calories:      Number(row.calories),
          carbs:         Number(row.carbs),
          protein:       Number(row.protein),
          fat:            Number(row.fat),
          avgShelfLife:  Number(row.avgShelfLife ?? 0),
          pieceWeight:   Number(row.pieceWeight ?? 0),
          addedDate:     new Date(),
          expirationDate: row.avgShelfLife
            ? new Date(Date.now() + Number(row.avgShelfLife) * 86400000)
            : new Date(),
        });
      });
      await batch.commit();
    };
    // ────────────────────────────────────────────────────────────
  


const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

// App.tsx 맨 위쪽, 컴포넌트 함수 안에
function calculateIngredientForm(): number {
  // ingredientForm.weight 만 반환하도록 단순화
  return ingredientForm.weight;
}

// 레시피 모달—특정 재료 삭제
const handleRemoveRecipeIngredient = (index: number) => {
  // 1. ingredients 배열에서 해당 인덱스 제거
  setRecipeForm(prev => ({
    ...prev,
    ingredients: prev.ingredients.filter((_, i) => i !== index)
  }));
  // 2. unitType / quantity 배열에서도 같은 인덱스 제거
  setRecipeUnitTypes(prev => prev.filter((_, i) => i !== index));
  setRecipeQuantities(prev => prev.filter((_, i) => i !== index));
};
const [ingredientSearch, setIngredientSearch] = useState<string>("");
const [ingredientSuggestions, setIngredientSuggestions] = useState<string[]>([]);
const [isDBAddModalOpen, setIsDBAddModalOpen] = useState<boolean>(false);
const [isDBEditing, setIsDBEditing] = useState<boolean>(false);



const [recipeUnitTypes, setRecipeUnitTypes] = useState<("g" | "count")[]>([]);
const [recipeQuantities, setRecipeQuantities] = useState<number[]>([]);
const [recipeSearchTerm, setRecipeSearchTerm] = useState<string>("");
const [recipeSuggestions, setRecipeSuggestions] = useState<string[]>([]);




// 편집 모드를 구분할 ID 상태
const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);


// 상세보기 모달 열림 여부, 선택된 레시피 저장
const [_isDetailModalOpen, _setIsDetailModalOpen] = useState(false);


const [recipes, setRecipes] = useState<Recipe[]>([]);


  const [toast, setToast] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [fridgeItems, setFridgeItems] = useState<FridgeItem[]>([]);
  

  
 
  useEffect(() => {
    const col = collection(db, "ingredients");
    const unsubscribe = onSnapshot(col, snapshot => {
      const items: Ingredient[] = snapshot.docs.map(d => {
        // Firestore에서 받아오는 데이터를 Timestamp 필드로 간주
        const data = d.data() as Omit<Ingredient, "id" | "addedDate" | "expirationDate"> & {
          addedDate?:      Timestamp;
          expirationDate?: Timestamp;
        };
        return {
          id:             d.id,
          name:           data.name,
          weight:         data.weight,
          calories:       data.calories,
          carbs:          data.carbs,
          protein:        data.protein,
          fat:             data.fat,
          avgShelfLife:   data.avgShelfLife,
          pieceWeight:    data.pieceWeight,
          // undefined 체크 후 toDate() 호출 (없으면 현재 시각으로 대체)
          addedDate:      data.addedDate
                            ? data.addedDate.toDate()
                            : new Date(),
          expirationDate: data.expirationDate
                            ? data.expirationDate.toDate()
                            : new Date(),
        };
      });
      setIngredients(items);
    });
    return () => unsubscribe();
  }, []);

  // 1) Firestore 'ingredients' 컬렉션 구독 useEffect 끝난 직후에 추가
useEffect(() => {
  // 검색어가 비어 있으면 suggestions 초기화
  if (!ingredientSearch) {
    setIngredientSuggestions([]);
    return;
  }
  if (ingredients.some(i => i.name === ingredientSearch)) {
    setIngredientSuggestions([]);
    return;
  }
  // ingredients 배열에서 name만 뽑아 필터링
  const matches = ingredients
    .map(i => i.name)
    .filter(name =>
      name.toLowerCase().includes(ingredientSearch.toLowerCase())
    );
  setIngredientSuggestions(matches);
}, [ingredientSearch, ingredients]);

  
  useEffect(() => {
    const col = collection(db, "fridgeItems");
    const unsub = onSnapshot(col, snap => {
      const items = snap.docs.map(d => {
        const data = d.data() as Omit<FridgeItem,"id"> & {
          addedDate:      Timestamp;
          expirationDate: Timestamp;
        };
        return {
          id:             d.id,
          name:           data.name,
          weight:         data.weight,
          addedDate:      data.addedDate.toDate(),
          expirationDate: data.expirationDate.toDate(),
        };
      });
      setFridgeItems(items);
    });
    return () => unsub();
  }, []);
  
  
  useEffect(() => {
    const colRec = collection(db, "recipes");
    const unsubRec = onSnapshot(colRec, snapshot => {
      const recs = snapshot.docs.map(doc => {
        const data = doc.data() as Omit<Recipe,"id"|"total">;
        return {
          id: doc.id,
          ...data,
          total: calculateRecipeTotalFromData(data.ingredients),
        };
      });
      setRecipes(recs);
    });
    return () => unsubRec();
  }, []);
  

  const calculateRecipeTotalFromData = (ings: RecipeIngredient[]) =>
    calculateRecipeTotal(ings);
    

  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [_expiryMode, _setExpiryMode] = useState("+3일");

  const [activeTab, setActiveTab] = useState<"list" | "db" | "fridge">("list");
  const handleSampleDownload = () => {
    const sampleData = [
      {
        name: "양파",
        weight: 100,
        calories: 40,
        carbs: 9,
        protein: 1,
        fat: 0,
        avgShelfLife: 21,    // 평균 유통기한 (일)
        pieceWeight: 200     // 1개당 평균 무게 (g)
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ingredients");
    XLSX.writeFile(wb, "sample_ingredients.xlsx");
  };
  




  const handleDelete = async (id: string) => {
    if (!confirm("이 재료를 영구 삭제할까요?")) return;
    await deleteDoc(doc(db, "ingredients", id));
    };
  


  // ↓ ingredientDB 대신, 실제 Firestore 구독 상태인 `ingredients` 배열을 필터링합니다.
useEffect(() => {
  if (!ingredientSearch) {
    setIngredientSuggestions([]);
    return;
  }

  const matches = ingredients
    .map(i => i.name)
    .filter(name =>
      name.toLowerCase().includes(ingredientSearch.toLowerCase())
    );
  setIngredientSuggestions(matches);
}, [ingredientSearch, ingredients]);

  



  const [ingredientForm, setIngredientForm] = useState<Omit<Ingredient, "id">>(initialIngredientForm);

  const [recipeForm, setRecipeForm] = useState({
    name: "",
    description: "",
    image: "",
    youtube: "",
    instagram: "",
    ingredients: [] as RecipeIngredient[],
  });

  

  const handleAddIngredientToRecipe = (name: string) => {
    if (!recipeForm.ingredients.find(i => i.name === name)) {
      const base = ingredients.find(i => i.name === name);
if (!base) return;
const { weight: defaultWeight, calories, carbs, protein, fat } = base;


      // ② setRecipeForm 에 반드시 모든 필드를 채운 객체를 넣어준다
      setRecipeForm(prev => ({
        ...prev,
        ingredients: [
          ...prev.ingredients,
          {
            name,
            weight: defaultWeight,
            calories,
            carbs,
            protein,
            fat
          }
        ]
      }));
      setRecipeUnitTypes(prev => [...prev, "g"]);
      setRecipeQuantities(prev => [...prev, 1]);
  
    }
  };
 
  const handleAddToDB = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    // 1) Firestore에 저장
    await addDoc(collection(db, "ingredients"), {
      name:         ingredientForm.name,
      weight:       ingredientForm.weight,
      calories:     ingredientForm.calories,
      carbs:        ingredientForm.carbs,
      protein:      ingredientForm.protein,
      fat:          ingredientForm.fat,
      avgShelfLife: ingredientForm.avgShelfLife ?? 0,
      pieceWeight:  ingredientForm.pieceWeight ?? 0,
    });
  
    // 2) 모달 닫기 및 폼 초기화
    setIsDBAddModalOpen(false);
    setIngredientForm({
      name: "",
      weight: 0,
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
      addedDate: new Date(),
      expirationDate: new Date(),
      avgShelfLife: 0,
      pieceWeight: 0
    });
    setIngredientSearch("");
    setIngredientSuggestions([]);
  };
  
 

  const updateIngredientWeight = (index: number, weight: number) => {
    const updated = [...recipeForm.ingredients];
    updated[index].weight = weight;
    setRecipeForm({ ...recipeForm, ingredients: updated });
  };

  const calculateRecipeTotal = (ings?: RecipeIngredient[]) => {
    let weight = 0, calories = 0, carbs = 0, protein = 0, fat = 0;
    const list = ings ?? recipeForm.ingredients;
    for (const item of list) {
      const base = ingredients.find(i => i.name === item.name);
      if (!base) continue;
  
      const ratio = item.weight / base.weight;
      weight += item.weight;
      calories += base.calories * ratio;
      carbs += base.carbs * ratio;
      protein += base.protein * ratio;
      fat += base.fat * ratio;
    }
    return {
      weight: Math.round(weight),
      calories: Math.round(calories),
      carbs: Math.round(carbs),
      protein: Math.round(protein),
      fat: Math.round(fat),
    };
  };
  
// 레시피 삭제
const handleDeleteRecipe = async (id: string) => {
  if (!confirm("정말 삭제할까요?")) return;
  await deleteDoc(doc(db, "recipes", id));
};

  // + handleRecipeSubmit 함수 정의 시작
  const handleRecipeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      name: recipeForm.name,
      description: recipeForm.description,
      image: recipeForm.image,
      youtube: recipeForm.youtube,
      instagram: recipeForm.instagram,
      ingredients: recipeForm.ingredients,
      total: calculateRecipeTotal(),
    };
    await addDoc(collection(db, "recipes"), payload);
    setIsRecipeModalOpen(false);
    setRecipeForm({ name:"", description:"", image:"", youtube:"", instagram:"", ingredients:[] });
  
  
  

  try {
    if (editingRecipeId) {
      // 수정 모드
      await updateDoc(doc(db, "recipes", editingRecipeId), payload);
    } else {
      // 신규 등록 모드
      const colRef = collection(db, "recipes");
      onSnapshot(colRef, snapshot => {
        const recs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Recipe[];
        setRecipes(recs);
      });
      const docRef = await addDoc(colRef, payload);
      // 로컬 state에도 반영
      setRecipes(prev => [
        ...prev,
        { id: docRef.id, ...payload }
      ]);
    }
  } catch (err) {
    console.error("레시피 저장 중 오류:", err);
  }

  // 모달 닫고, 폼 초기화
  setIsRecipeModalOpen(false);
  setEditingRecipeId(null);
  setRecipeForm({
    name: "",
    description: "",
    image: "",
    youtube: "",
    instagram: "",
    ingredients: []
  });
  setRecipeUnitTypes([]);
  setRecipeQuantities([]);
};
// - handleRecipeSubmit 함수 정의 끝



// 레시피 수정 모드로 전환
const handleEditRecipe = (r: Recipe) => {
  setRecipeForm({
    name:        r.name,
    description: r.description || "",
    image:       r.image || "",
    youtube:     r.youtube || "",
    instagram:   r.instagram || "",
    ingredients: r.ingredients.map(i => {
      const dbItem = ingredients.find(item => item.name === i.name) || { calories: 0, carbs: 0, protein: 0, fat: 0 };
      return {
        name: i.name,
        weight: i.weight,
        calories: dbItem.calories,
        carbs:    dbItem.carbs,
        protein:  dbItem.protein,
        fat:      dbItem.fat
      };
  }),
  // 단위·수량 배열도 원래 값으로 채워두면 좋습니다
});
  setRecipeUnitTypes(r.ingredients.map(_ => "g"));
  setRecipeQuantities(r.ingredients.map(_ => 1));
  setEditingRecipeId(r.id);
  setIsRecipeModalOpen(true);
};




  const saveRecipe = () => {
    // 수정 모드라면 기존 배열 업데이트
  if (editingRecipeId) {
    setRecipes(prev =>
      prev.map(r =>
        r.id === editingRecipeId
          ? {
              ...r,
              name:        recipeForm.name,
              description: recipeForm.description,
              image:       recipeForm.image,
              youtube:     recipeForm.youtube,
              instagram:   recipeForm.instagram,
              ingredients: recipeForm.ingredients.map(item => {
                const base =
                ingredients.find(i => i.name === item.name)!;
                const ratio = item.weight / base.weight;
                return {
                  name:     item.name,
                  weight:   item.weight,
                  calories: Math.round(base.calories * ratio),
                  carbs:    Math.round(base.carbs * ratio),
                  protein:  Math.round(base.protein * ratio),
                  fat:      Math.round(base.fat * ratio),
                };
              }),
            }
          : r
      )
    );
    setEditingRecipeId(null);
    setIsRecipeModalOpen(false);
    return;
  }
      const hasEmpty = (
        recipeForm.name.trim() === "" ||
        recipeForm.ingredients.length === 0 ||
        recipeForm.ingredients.some(i => !i.weight || i.weight <= 0)
      );
    
      if (hasEmpty) {
        setToast("⚠️ 모든 항목을 입력해주세요");
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const fullWithNulls = recipeForm.ingredients.map(item => {
        const base =
        ingredients.find(i => i.name === item.name)!;
        if (!base) return null
        const ratio = item.weight / base.weight
        return {
          name: item.name,
          weight: item.weight,
          calories: Math.round(base.calories * ratio),
          carbs:    Math.round(base.carbs    * ratio),
          protein:  Math.round(base.protein  * ratio),
          fat:      Math.round(base.fat      * ratio),
        }
      })
      
      const full: RecipeIngredient[] = fullWithNulls.filter(
        (x): x is RecipeIngredient => x !== null
      )
      
      // now sum up totals
      const total = full.reduce(
        (acc, cur) => ({
          weight:   acc.weight   + cur.weight,
          calories: acc.calories + cur.calories,
          carbs:    acc.carbs    + cur.carbs,
          protein:  acc.protein  + cur.protein,
          fat:      acc.fat      + cur.fat,
        }),
        { weight: 0, calories: 0, carbs: 0, protein: 0, fat: 0 }
      )
      
      setRecipes([
        ...recipes,
        {
          id:           crypto.randomUUID(),
          name:         recipeForm.name,
          description:  recipeForm.description,
          image:        recipeForm.image,
          youtube:      recipeForm.youtube,
          instagram:    recipeForm.instagram,
          ingredients:  full,
          total,
        },
      ])
      
      
  
    // 초기화
    setRecipeForm({
      name:        "",
      description: "",
      image:       "",
      youtube:     "",
      instagram:   "",
      ingredients: [],
    })
    setIsRecipeModalOpen(false)
    
  };
  

  const handleAddIngredient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await addDoc(collection(db, "fridgeItems"), {
      ...ingredientForm
    });
    setIsIngredientModalOpen(false);
    setIngredientForm(initialIngredientForm);
  };
 




  
  
  

  const thStyle = {
    border: "1px solid #444",
    padding: "8px",
    background: "#222",
    fontWeight: "bold",
  };
  
  const tdStyle = {
    border: "1px solid #444",
    padding: "8px",
  };
  

  return (
    <>
      {toast && (
        <div style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#885C09",
          color: "white",
          padding: "10px 20px",
          borderRadius: "6px",
          zIndex: 2000
        }}>
      {toast}
  </div>
)}

<div style={{ display: "flex", gap: "12px", padding: "20px" }}>
  <button
    onClick={() => setActiveTab("list")}
    style={{
      padding: "8px 16px",
      borderRadius: "8px",
      border: "none",
      backgroundColor: activeTab === "list" ? "#71ACFF" : "#DCE8F9",
      color: activeTab === "list" ? "#fff" : "#1A79FF",
      fontWeight: "bold",
      cursor: "pointer"
    }}
  >
    레시피북
  </button>
  <button
    onClick={() => setActiveTab("db")}
    style={{
      padding: "8px 16px",
      borderRadius: "8px",
      border: "none",
      backgroundColor: activeTab === "db" ? "#71ACFF" : "#DCE8F9",
      color: activeTab === "db" ? "#fff" : "#1A79FF",
      fontWeight: "bold",
      cursor: "pointer"
    }}
  >
    식재료 DB
  </button>
  <button
  onClick={() => {
    setIsDBEditing(false);
    setIsDBAddModalOpen(false);
    setActiveTab("fridge");
  }}
  style={{
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: activeTab === "fridge" ? "#71ACFF" : "#DCE8F9",
    color: activeTab === "fridge" ? "#fff" : "#1A79FF",
    fontWeight: "bold",
    cursor: "pointer"
  }}
>
  냉장고
</button>

</div>




{activeTab === "db" && (
  <div style={{ padding: 20 }}>
    <h2>📦 식재료 DB</h2>
    <div style={{ marginBottom: "16px" }}>
    </div>
    <p style={{ fontSize: "0.85rem", color: "#ccc", marginTop: "6px" }}>
      ※ 엑셀 파일은 아래 순서의 컬럼을 포함해야 합니다: <br />
      <strong>name, weight, calories, carbs, protein, fat</strong>
    </p>
    
    <input
      type="file"
      accept=".xlsx, .xls"
      onChange={handleExcelUpload}
      style={{
        margin: "20px 0",
        padding: "8px",
        background: "#333",
        color: "white",
        borderRadius: "6px"
      }}
    />
    {isDBAddModalOpen && (
  <div
    style={{
      position: "fixed",
      top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex", justifyContent: "center", alignItems: "center"
    }}
  >
    <div style={{
      background: "#fff",
      padding: 20, borderRadius: 8, width: 400
    }}>
      <h2>단건 식재료 추가</h2>
      <form onSubmit={handleAddToDB}>
     {/* — 엑셀 양식과 동일한 단건 추가 필드 */}
<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  이름
  <input
    type="text"
    value={ingredientForm.name}
    onChange={e =>
      setIngredientForm(f => ({ ...f, name: e.target.value }))
    }
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  기준 무게 (g)
  <input
    type="number"
    value={ingredientForm.weight}
    onChange={e =>
      setIngredientForm(f => ({ ...f, weight: Number(e.target.value) }))
    }
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  칼로리 (kcal)
  <input
    type="number"
    value={ingredientForm.calories}
    onChange={e =>
      setIngredientForm(f => ({ ...f, calories: Number(e.target.value) }))
    }
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  탄수화물 (g)
  <input
    type="number"
    value={ingredientForm.carbs}
    onChange={e =>
      setIngredientForm(f => ({ ...f, carbs: Number(e.target.value) }))
    }
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  단백질 (g)
  <input
    type="number"
    value={ingredientForm.protein}
    onChange={e =>
      setIngredientForm(f => ({ ...f, protein: Number(e.target.value) }))
    }
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  지방 (g)
  <input
    type="number"
    value={ingredientForm.fat}
    onChange={e =>
      setIngredientForm(f => ({ ...f, fat: Number(e.target.value) }))
    }
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  평균 유통기한 (일)
  <input
    type="number"
    value={ingredientForm.avgShelfLife ?? ""}
    onChange={e =>
      setIngredientForm(f => ({
        ...f,
        avgShelfLife: Number(e.target.value)
       }))
      }
      />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  1개당 무게 (g)
  <input
    type="number"
    value={ingredientForm.pieceWeight ?? ""}
    onChange={e =>
      setIngredientForm(f => ({
        ...f,
        pieceWeight: Number(e.target.value)
      }))
    }
  />
</label>

<button type="submit">
  {isDBEditing ? "수정" : "추가"}
</button>
        <button
          type="button"
          onClick={() => {
            setIsDBAddModalOpen(false);
setIngredientForm({
  name: "",
  addedDate: new Date(),
  expirationDate: new Date(),
  weight: 0,
  calories: 0,
  carbs: 0,
  protein: 0,
  fat: 0,
  avgShelfLife: 0,
  pieceWeight: 0
});
setIngredientSearch("");
setIngredientSuggestions([]);

          }}
          style={{ marginLeft: 8 }}
        >
          취소
        </button>
      </form>
    </div>
  </div>
)}

<button
  onClick={() => {
    setIsDBEditing(false);
    setIsDBAddModalOpen(true);
  }}
  style={{ marginLeft: 8 }}
>
  + 재료 단건 추가
</button>


<button
      onClick={handleSampleDownload}
      style={{
        marginTop: "10px",
        padding: "6px 10px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer"
      }}
    >
      📄 샘플 엑셀 다운로드
    </button>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>
    <tr>
      <th style={{ border: "1px solid #555", padding: "8px" }}>식재료명</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>기준 무게 (g)</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>칼로리</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>탄수화물</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>단백질</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>지방</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>평균 유통기한 (일)</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>1개당무게</th>
      <th style={{ border: "1px solid #555", padding: "8px" }}>액션</th>
    </tr>
  </thead>
  <tbody>
  {ingredients.map(i => (
    <tr key={i.id}>
      <td style={tdStyle}>{i.name}</td>
      <td style={tdStyle}>{i.weight}</td>
      <td style={tdStyle}>{i.calories}</td>
      <td style={tdStyle}>{i.carbs}</td>
      <td style={tdStyle}>{i.protein}</td>
      <td style={tdStyle}>{i.fat}</td>
      <td style={tdStyle}>{i.avgShelfLife}</td>
      <td style={tdStyle}>{i.pieceWeight}</td>
      <td style={tdStyle}>
        <button onClick={() => handleDelete(i.id)}>삭제</button>
      </td>    
    </tr>
   ))}
  </tbody>
</table>

  </div>
)}

{(activeTab === "list") && (
  <div style={{ padding: 20 }}>
    <h2>🍳 레시피 리스트</h2>
    <button onClick={() => setIsRecipeModalOpen(true)}>+ 레시피 추가</button>

    {/* 레시피 카드 리스트 */}
    <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
      {recipes.map(r => {
        const canMake = r.ingredients.every((ing) =>
          ingredients.some((i) => i.name === ing.name)
        );
        return (
          <div key={r.id} style={{
            background: "#f5f5f5",
            padding: "16px",
            borderRadius: "12px",
            color: "#222",
            fontSize: "14px"
          }}>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>
              {r.name}
              {canMake && (
                <span style={{
                  backgroundColor: "green",
                  color: "white",
                  fontSize: "0.75rem",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  float: "right",
                  marginLeft: "8px"
                }}>
                  지금 만들 수 있어요
                </span>
              )}
            </h3>
            <p style={{ margin: "4px 0", color: "#666" }}>
              {r.total.calories}Kcal | 탄 {r.total.carbs}g | 단 {r.total.protein}g | 지 {r.total.fat}g
            </p>
            <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {r.ingredients.map(i => (
                <span key={i.name} style={{
                  background: "#eee", padding: "2px 6px", borderRadius: "8px", fontSize: "12px"
                }}>
                  #{i.name}
                </span>
              ))}
              
<div style={{ marginTop: "12px" }}>
  <button
    onClick={() => setSelectedRecipe(r)}
    style={{
      padding: "6px 12px",
      background: "#222",
      color: "white",
      borderRadius: 4,
      border: "none",
      cursor: "pointer"
    }}
  >
    레시피 자세히 보기 &gt;
  </button>
</div>

            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={() => handleEditRecipe(r)}>수정</button>
              <button onClick={() => handleDeleteRecipe(r.id)}>삭제</button>
            </div>
          </div>
        );
      })}
    </div>

    
  </div>
)}

{(activeTab === "fridge") && (
  <div style={{ padding: 20 }}>
    <h2 style={{ marginTop: 40 }}>🥦 마이냉장고 🥦</h2>
    <button onClick={() => {setIsIngredientModalOpen(true);setIngredientSearch("");}}>+ 냉장고에 재료 넣기</button>
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginTop: 16,
      }}
    >
      <thead>
        <tr>
          <th style={thStyle}>이름</th>
          <th style={thStyle}>무게 (g)</th>
          <th style={thStyle}>추가일</th>
          <th style={thStyle}>유통기한</th>
          <th style={thStyle}>액션</th>
        </tr>
      </thead>
      <tbody>
      {fridgeItems.map(i => (
  <tr key={i.id}>
    <td>{i.name}</td>
    <td>{i.weight}</td>
    <td>{format(i.addedDate,      "yyyy-MM-dd")}</td>
    <td>{format(i.expirationDate, "yyyy-MM-dd")}</td>
    <td><button onClick={() => deleteDoc(doc(db,"fridgeItems",i.id))}>삭제</button></td>
  </tr>
))}
      </tbody>
    </table>
  </div>
)}


      {isRecipeModalOpen && (
        <form onSubmit={handleRecipeSubmit} style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#fff",
            padding: 20,
            borderRadius: 8,
            width: 600
          }}>
          <h2>레시피 추가</h2>
          <label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
            레시피 이름
            <input
            value={recipeForm.name}
            onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  상세 설명
  <textarea
    value={recipeForm.description}
    onChange={e => setRecipeForm(f => ({ ...f, description: e.target.value }))}
    rows={3}
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  이미지 URL
  <input
    type="text"
    value={recipeForm.image}
    onChange={e => setRecipeForm(f => ({ ...f, image: e.target.value }))}
    placeholder="https://..."
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  YouTube 링크
  <input
    type="text"
    value={recipeForm.youtube}
    onChange={e => setRecipeForm(f => ({ ...f, youtube: e.target.value }))}
    placeholder="https://www.youtube.com/..."
  />
</label>

<label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
  Instagram 링크
  <input
    type="text"
    value={recipeForm.instagram}
    onChange={e => setRecipeForm(f => ({ ...f, instagram: e.target.value }))}
    placeholder="https://www.instagram.com/..."
  />
</label>

          <label style={{ display: "flex", flexDirection: "column", marginBottom: 12, position: "relative" }}>
  재료 검색
  <input
    type="text"
    value={recipeSearchTerm}
    onChange={e => {
      const term = e.target.value;
      setRecipeSearchTerm(term);
      setRecipeSuggestions(
        ingredients
          .map(i => i.name)
          .filter(name =>
            name.toLowerCase().includes(term.toLowerCase())
          )
      );
    }}
    placeholder="예) 양파, 두부…"
    style={{ padding: "8px", borderRadius: 4, border: "1px solid #555" }}
  />
  {recipeSuggestions.length > 0 && (
    <ul
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        maxHeight: 160,
        overflowY: "auto",
        background: "#fff",
        border: "1px solid #999",
        borderRadius: "0 0 4px 4px",
        margin: 0,
        padding: 0,
        listStyle: "none",
        zIndex: 10
      }}
    >
      {recipeSuggestions.map(name => (
        <li
          key={name}
          onClick={() => {
            handleAddIngredientToRecipe(name);
            setRecipeSearchTerm("");
            setRecipeSuggestions([]);
          }}
          style={{
            padding: "6px 8px",
            cursor: "pointer"
          }}
        >
          {name}
        </li>
      ))}
    </ul>
  )}
</label>


            {recipeForm.ingredients.length === 0 ? (
  <div style={{
    padding: "24px",
    backgroundColor: "#F7F7F7",
    textAlign: "center",
    borderRadius: "4px",
    marginTop: "12px"
  }}>
    재료를 추가해주세요
  </div>
) : (
  <table>
    <thead>
  <tr>
    <th>재료명</th>
    <th>무게</th>
    <th>칼로리</th>
    <th></th>
  </tr>
</thead>

    <tbody>
      {recipeForm.ingredients.map((item, idx) => {
        const base = ingredients.find(i => i.name === item.name);
        if (!base) return null;
        const ratio = item.weight / base.weight;
        return (
          <tr key={item.name}>
            <td>{item.name}</td>
<td>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {recipeUnitTypes[idx] === "g" ? (
      <input
        type="number"
        value={item.weight}
        onChange={e => updateIngredientWeight(idx, Number(e.target.value))}
        style={{ flex: 1 }}
      />
    ) : (
      <input
        type="number"
        value={recipeQuantities[idx]}
        onChange={e => {
          const q = Number(e.target.value);
          setRecipeQuantities(prev => {
            const arr = [...prev];
            arr[idx] = q;
            return arr;
          });
          const picked = ingredients.find(i => i.name === item.name)!;
          const base   = picked.pieceWeight ?? picked.weight;
          updateIngredientWeight(idx, q * base);
        }}
        style={{ flex: 1 }}
      />
    )}

    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="radio"
          checked={recipeUnitTypes[idx] === "g"}
          onChange={() => {
            setRecipeUnitTypes(prev => {
              const arr = [...prev];
              arr[idx] = "g";
              return arr;
            });
          }}
        />
        g
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="radio"
          checked={recipeUnitTypes[idx] === "count"}
          disabled={!ingredients.find(i => i.name === item.name)?.pieceWeight}
          onChange={() => {
            setRecipeUnitTypes(prev => {
              const arr = [...prev];
              arr[idx] = "count";
              return arr;
            });
            setRecipeQuantities(prev => {
              const arr = [...prev];
              arr[idx] = 1;
              return arr;
            });
            const picked = ingredients.find(i => i.name === item.name)!;
            const baseWeight = picked.pieceWeight ?? picked.weight;
            updateIngredientWeight(idx, baseWeight);
          }}
        />
        개수
      </label>
    </div>
  </div>
</td>

            <td>{Math.round(base.calories * ratio)}</td>
            <td>
    <button
      type="button"
      onClick={() => handleRemoveRecipeIngredient(idx)}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: "1.1rem",
        color: "#f55"
      }}
      title="삭제"
    >
      ❌
    </button>
  </td>
          </tr>
        );
      })}
    </tbody>
  </table>
)}


          <div style={{ marginTop: 12 }}>
            <strong>합계:</strong> {calculateIngredientForm()}g / {calculateRecipeTotal().calories}kcal |
            탄: {calculateRecipeTotal().carbs}g / 단: {calculateRecipeTotal().protein}g / 지: {calculateRecipeTotal().fat}g
          </div>

          <button onClick={saveRecipe}>등록</button>
          <button
  onClick={() => {
    // 1) 모달 닫기
    setIsRecipeModalOpen(false);

    // 2) 레시피 폼 초기화 (image 필드 포함)
    setRecipeForm({
  name:        "",
  description: "",
  image:       "",
  youtube:     "",
  instagram:   "",
  ingredients: [],
})
setIsRecipeModalOpen(false)


    // 3) 단위·수량 배열 초기화
    setRecipeUnitTypes([]);
    setRecipeQuantities([]);
  }}
>
  취소
</button>

        </div>
      </form>
      )}
      
{selectedRecipe && (
  <div
    className={`drawer ${selectedRecipe ? "visible" : "hidden"}`}
    style={{
      position: "fixed",
      top: 0,
      right: 0,
      width: "50%",
      height: "100%",
      background: "#fff",
      color: "#000",
      boxShadow: "-4px 0 8px rgba(0,0,0,0.2)",
      padding: 20,
      overflowY: "auto",
      zIndex: 1500
    }}
  >
    <button
      onClick={() => setSelectedRecipe(null)}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        background: "transparent",
        border: "none",
        fontSize: "1.2rem",
        cursor: "pointer"
      }}
    >
      ×
    </button>
    {/* 레시피 이름 타이틀 */}
    <h2 style={{ color: "#222", marginBottom: "16px", fontSize: "1.5rem" }}>{selectedRecipe.name} 레시피</h2>

    {selectedRecipe.image && (
      <img
        src={selectedRecipe.image}
        alt="recipe"
        style={{ width: "100%", borderRadius: 8, marginBottom: 16 }}
      />
    )}

    <div style={{ marginBottom: 16 }}>
    <h3 style={{ color: "#222" }}>상세 설명</h3>
    <p style={{ whiteSpace: "pre-wrap", color: "#444" }}>{selectedRecipe.description}</p>
    </div>

    {selectedRecipe.youtube && (
      <div style={{ marginBottom: 8 }}>
        ▶️{" "}
        <a href={selectedRecipe.youtube} target="_blank" rel="noopener noreferrer">
          YouTube 링크 바로가기
        </a>
      </div>
    )}

    {selectedRecipe.instagram && (
      <div>
        📸{" "}
        <a href={selectedRecipe.instagram} target="_blank" rel="noopener noreferrer">
          Instagram 바로가기
        </a>
      </div>
    )}
  </div>
)}

  {/* 3) 냉장고에 재료 넣기 모달 */}
  {isIngredientModalOpen && (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center"
    }}>
      <div style={{ background: "#fff", padding: 20, borderRadius: 8, width: 500 }}>
        <h2>냉장고에 재료 넣기</h2>
        <form onSubmit={handleAddIngredient}>

          {/* 재료 검색 */}
          <label style={{ display: "flex", flexDirection: "column", marginBottom: 12, position: "relative" }}>
            재료 검색
            <input
              type="text"
              value={ingredientSearch}
              onChange={e => {
                const term = e.target.value;
                setIngredientSearch(term);
                setIngredientSuggestions(
                  ingredients
                    .map(i => i.name)
                    .filter(name =>
                      name.toLowerCase().includes(term.toLowerCase())
                    )
                );
                
              }}
              placeholder="예) 양파, 두부…"
              style={{ padding: "8px", borderRadius: 4, border: "1px solid #555" }}
            />
            {ingredientSuggestions.length > 0
  && !(ingredientSuggestions.length === 1
       && ingredientSuggestions[0] === ingredientSearch)
  && (
              <ul style={{
                position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 150, overflowY: "auto",
                background: "#fff", border: "1px solid #555", borderRadius: "0 0 4px 4px",
                margin: 0, padding: 0, listStyle: "none", zIndex: 10
              }}>
                {ingredientSuggestions.map(name => {
        // 이제 Firestore에서 구독한 리스트에서 찾습니다
        const info = ingredients.find(i => i.name === name)!;
        return (
          <li
            key={name}
            onClick={() => {
              setIngredientForm(f => ({
                ...f,
                name,
                weight:     info.weight,
                calories:   info.calories,
                carbs:      info.carbs,
                protein:    info.protein,
                fat:         info.fat,
                avgShelfLife: info.avgShelfLife ?? 0,
                pieceWeight:  info.pieceWeight ?? 0,
                expirationDate: (() => {
                  const exp = new Date(f.addedDate);
                  exp.setDate(exp.getDate() + (info.avgShelfLife ?? 0));
                  return exp;
                })()
              }));
              setIngredientSearch(name);
              setIngredientSuggestions([]);
            }}
            style={{ padding: "6px 8px", cursor: "pointer" }}
          >
            {name}
          </li>
        );
      })}
              </ul>
            )}
          </label>

          {/* 등록일 */}
          <label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
            등록일
            <input
              type="date"
              value={format(ingredientForm.addedDate, "yyyy-MM-dd")}
              onChange={e => setIngredientForm({ ...ingredientForm, addedDate: new Date(e.target.value) })}
              style={{ width: "200px" }}
            />
          </label>

          {/* 무게 */}
          <label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
            무게 (g)
            <input
              type="number"
              value={ingredientForm.weight}
              onChange={e => setIngredientForm({ ...ingredientForm, weight: Number(e.target.value) })}
            />
          </label>

          <div style={{ marginTop: 12 }}>
          <strong>합계:</strong> {calculateIngredientForm()}g
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button type="submit">추가</button>
            <button type="button" onClick={() => setIsIngredientModalOpen(false)}>취소</button>
          </div>
        </form>
      </div>
    </div>
  )}

</>);
}

export default App;
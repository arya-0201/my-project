import * as XLSX from "xlsx";
import "./App.css";
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, doc, onSnapshot } from "firebase/firestore";



interface Ingredient {
  id: string;
  name: string;
  weight: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  addedDate: Date;
  expirationDate: Date;
  avgShelfLife: number;   
  pieceWeight?: number;   
}

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
  // 복사용
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
// DB 탭—식재료 삭제
const handleDeleteIngredientDB = (name: string) => {
  setIngredientDB(prev => {
    const newDB = { ...prev };
    delete newDB[name];
    return newDB;
  });
};

// DB 탭—식재료 편집: 단건 추가 모달 오픈 및 폼에 값 채우기
const handleEditIngredientDB = (name: string) => {
  const info = ingredientDB[name]!;
  setIngredientForm({
    name,
    weight:       info.weight,
    calories:     info.calories,
    carbs:        info.carbs,
    protein:      info.protein,
    fat:           info.fat,
    addedDate:    new Date(),  // 필요에 따라 수정
    expirationDate: new Date(Date.now() + (info.avgShelfLife ?? 0) * 24*60*60*1000),
    avgShelfLife: info.avgShelfLife ?? 0,
    pieceWeight:  info.pieceWeight ?? 0
  });
  setIsDBEditing(true);
  setIsDBAddModalOpen(true);
};
const [recipeUnitTypes, setRecipeUnitTypes] = useState<("g" | "count")[]>([]);
const [recipeQuantities, setRecipeQuantities] = useState<number[]>([]);
const [recipeSearchTerm, setRecipeSearchTerm] = useState<string>("");
const [recipeSuggestions, setRecipeSuggestions] = useState<string[]>([]);




interface FridgeItem {
  id: string;
  name: string;
  addedDate: Date;
  expirationDate: Date;
  weight: number;
}
const [_fridgeItems, _setFridgeItems] = useState<FridgeItem[]>([]);

// 편집 모드를 구분할 ID 상태
const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

function _calcTotal(
  ings: { name: string; weight: number; calories: number; }[]
): number {
  return ings.reduce((sum, i) => sum + (i.calories * i.weight) / 100, 0);
}

// 상세보기 모달 열림 여부, 선택된 레시피 저장
const [_isDetailModalOpen, _setIsDetailModalOpen] = useState(false);


const [recipes, setRecipes] = useState<Recipe[]>([]);


  const [toast, setToast] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  

  
 
  useEffect(() => {
    const col = collection(db, "ingredients");
    const unsubscribe = onSnapshot(col, snapshot => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data() as {
          name: string;
          weight: number;
          calories: number;
          carbs: number;
          protein: number;
          fat: number;
          avgShelfLife?: number;
          pieceWeight?: number;
        };
        return { id: doc.id, ...data };
      });
      
  
      const mapByName = items.reduce((acc, {
        name,
        weight,
        calories,
        carbs,
        protein,
        fat,
        avgShelfLife,
        pieceWeight
      }) => {
        if (!name) return acc;
        acc[name] = { weight, calories, carbs, protein, fat, avgShelfLife, pieceWeight };
        return acc;
      }, {} as Record<string, {
        weight: number;
        calories: number;
        carbs: number;
        protein: number;
        fat: number;
        avgShelfLife?: number;
        pieceWeight?: number;
      }>);
  
      setIngredientDB(mapByName);
    });
  
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    const colRec = collection(db, "recipes");
    const unsubRec = onSnapshot(colRec, snapshot => {
      const recs: Recipe[] = snapshot.docs.map(doc => {
        const data = doc.data() as Omit<Recipe, "total" | "id">;

        // 영양성분 총합 계산
        const total = data.ingredients.reduce((acc, i) => {
          const _ratio = i.weight / (i.weight /* 원본 기준무게 */);
          return {
            weight:   acc.weight   + i.weight,
            calories: acc.calories + (i.calories * i.weight) / 100,
            carbs:    acc.carbs    + (i.carbs    * i.weight) / 100,
            protein:  acc.protein  + (i.protein  * i.weight) / 100,
            fat:      acc.fat      + (i.fat      * i.weight) / 100,
          };
        }, { weight: 0, calories: 0, carbs: 0, protein: 0, fat: 0 });
      
        return {
          id: doc.id,
          ...data,
          total: {
            weight:   Math.round(total.weight),
            calories: Math.round(total.calories),
            carbs:    Math.round(total.carbs),
            protein:  Math.round(total.protein),
            fat:      Math.round(total.fat),
          },
        };
      });
      setRecipes(recs);
    });
    return () => unsubRec();
  }, []);
  

    

  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [_expiryMode, _setExpiryMode] = useState("+3일");
  const [ingredientDB, setIngredientDB] = useState<{
    [name: string]: { weight: number; calories: number; carbs: number; protein: number; fat: number; avgShelfLife?: number; pieceWeight?: number } }>({});
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
  
  const [editingFridgeId, setEditingFridgeId] = useState<string | null>(null);



  const handleDelete = (id: string) => {
    setIngredients(ingredients.filter((i) => i.id !== id));
  };
  
  const handleEdit = (item: Ingredient) => {
    setIngredientForm(item);
    setIsIngredientModalOpen(true);
  };

  useEffect(() => {
    const names = Object.keys(ingredientDB);
    const filtered = names.filter(name =>
      name.toLowerCase().includes(ingredientSearch.toLowerCase())
    );
    setIngredientSuggestions(filtered);
  }, [ingredientDB, ingredientSearch]);
  



  const [ingredientForm, setIngredientForm] = useState<Omit<Ingredient, "id">>({
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
      const { weight: defaultWeight, calories, carbs, protein, fat } = ingredientDB[name];

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
 
  const handleAddToDB = (e: React.FormEvent) => {
    e.preventDefault();
  
  
    // 모달 닫기 및 폼 초기화
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

  const calculateRecipeTotal = () => {
    let weight = 0, calories = 0, carbs = 0, protein = 0, fat = 0;
    for (const item of recipeForm.ingredients) {
      const base = ingredients.find(i => i.name === item.name) || ingredientDB[item.name];
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
const handleDeleteRecipe = (id: string) => {
  if (!window.confirm("정말 이 레시피를 삭제할까요?")) return;
  setRecipes(prev => prev.filter(r => r.id !== id));
};

  // + handleRecipeSubmit 함수 정의 시작
const handleRecipeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  const payload = {
    name:        recipeForm.name,
    description: recipeForm.description,
    image:       recipeForm.image,
    youtube:     recipeForm.youtube,
    instagram:   recipeForm.instagram,
    ingredients: recipeForm.ingredients,
    total:       calculateRecipeTotal(),  // ← 객체 반환!
  };
  

  try {
    if (editingRecipeId) {
      // 수정 모드
      await updateDoc(doc(db, "recipes", editingRecipeId), payload);
    } else {
      // 신규 등록 모드
      const colRef = collection(db, "recipes");
      const _unsubscribe = onSnapshot(colRef, snapshot => {
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
      const dbItem = ingredientDB[i.name] || { calories: 0, carbs: 0, protein: 0, fat: 0 };
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
                  ingredients.find(i => i.name === item.name) || ingredientDB[item.name]!;
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
          ingredients.find(i => i.name === item.name) ||
          ingredientDB[item.name]
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
  

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      ingredientForm.name.trim() === "" ||
      !ingredientForm.weight ||
      !ingredientForm.calories ||
      !ingredientForm.carbs ||
      !ingredientForm.protein
    ) {
      alert("⚠️ 모든 항목을 입력해주세요");
      return;
    }

    const newItem: Ingredient = {
      id: crypto.randomUUID(),
      ...ingredientForm,
    };

    setIngredients([...ingredients, newItem]);
    saveToDB(ingredientForm.name, {
      name:         ingredientForm.name,
      weight:       ingredientForm.weight,
      calories:     ingredientForm.calories,
      carbs:        ingredientForm.carbs,
      protein:      ingredientForm.protein,
      fat:          ingredientForm.fat,
      avgShelfLife: ingredientForm.avgShelfLife ?? 0,
      pieceWeight:  ingredientForm.pieceWeight  ?? 0,
    });

    
    
    if (editingFridgeId) {
      _setFridgeItems(prev =>
        prev.map(item =>
          item.id === editingFridgeId
            ? {
                ...item,
                name:           ingredientForm.name,
                addedDate:      ingredientForm.addedDate,
                expirationDate: ingredientForm.expirationDate,
                weight:         ingredientForm.weight
              }
            : item
        )
      );
      setEditingFridgeId(null);
    }
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
    _setExpiryMode("+3일");
    setIsIngredientModalOpen(false);
    
    _setFridgeItems(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name:           ingredientForm.name,
        addedDate:      ingredientForm.addedDate,
        expirationDate: ingredientForm.expirationDate,
        weight:         ingredientForm.weight
      }
    ]);
    
    
  };
  const saveToDB = (_name: string, _data: Omit<Ingredient, "id" | "addedDate" | "expirationDate"> & Partial<Pick<Ingredient, "avgShelfLife" | "pieceWeight">>) => {
    
    addDoc(collection(db, "ingredients"), {
      name:         ingredientForm.name,
      weight:       ingredientForm.weight,
      calories:     ingredientForm.calories,
      carbs:        ingredientForm.carbs,
      protein:      ingredientForm.protein,
      fat:          ingredientForm.fat,
      avgShelfLife: ingredientForm.avgShelfLife ?? 0,
      pieceWeight:  ingredientForm.pieceWeight  ?? 0,
      });
      
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
  
      const workbook = XLSX.read(data, { type: "binary" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
  
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as {
        name: string;
        weight: number;
        calories: number;
        carbs: number;
        protein: number;
        fat: number;
        avgShelfLife?: number;
        pieceWeight?: number;
      }[];
      
      const newDB: typeof ingredientDB = {};
      
      for (const row of jsonData) {
        const {
          name,
          weight,
          calories,
          carbs,
          protein,
          fat,
          avgShelfLife,
          pieceWeight
        } = row;
        
      
        if (!name || !weight) continue;
      
        newDB[name] = {
          weight,
          calories,
          carbs,
          protein,
          fat,
          avgShelfLife: avgShelfLife  ?? 0,
          pieceWeight:  pieceWeight   ?? 0,
        };
      }
      
      
  
      const merged = { ...ingredientDB, ...newDB };
      setIngredientDB(merged);
      
    };
  
    reader.readAsBinaryString(file);
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
    {Object.entries(ingredientDB).map(([name, info]) => (
      <tr key={name}>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{name}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{info.weight}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{info.calories}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{info.carbs}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{info.protein}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{info.fat}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{info.avgShelfLife}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>{info.pieceWeight}</td>
        <td style={{ border: "1px solid #555", padding: "8px" }}>
          <button type="button" onClick={() => handleEditIngredientDB(name)} style={{ marginRight: 8 }}>
            수정
          </button>
          <button
  type="button"
  onClick={() => {
    if (window.confirm("정말 삭제할까요?")) {
      handleDeleteIngredientDB(name);
    }
  }}
>
  삭제
</button>

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

    {/* 식재료 테이블 */}
    <table style={{ width: "100%", borderCollapse: "collapse", color: "white", marginTop: "16px" }}>
      <thead>
        <tr>
          <th style={thStyle}>식재료명</th>
          <th style={thStyle}>등록일</th>
          <th style={thStyle}>유통기한</th>
          <th style={thStyle}>수정</th>
          <th style={thStyle}>삭제</th>
        </tr>
      </thead>
      <tbody>
        {ingredients.map((i) => (
          <tr key={i.id}>
            <td style={tdStyle}>{i.name}</td>
            <td style={tdStyle}>{format(i.addedDate, "yy.MM.dd")}</td>
            <td style={tdStyle}>
              {format(i.expirationDate, "yy.MM.dd")}
              {(() => {
                const today = new Date();
                const diff = Math.ceil((i.expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diff >= 0 && diff <= 3) {
                  return (
                    <span style={{
                      backgroundColor: "orange",
                      color: "white",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      marginLeft: "6px"
                    }}>
                      3일이내
                    </span>
                  );
                }
                return null;
              })()}
            </td>
            <td style={tdStyle}>
              <button onClick={() => handleEdit(i)}>수정</button>
            </td>
            <td style={tdStyle}>
              <button onClick={() => handleDelete(i.id)}>삭제</button>
            </td>
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
        Object.keys(ingredientDB)
          .filter(name => name.toLowerCase().includes(term.toLowerCase()))
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
        const base = ingredients.find(i => i.name === item.name) || ingredientDB[item.name];
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
          const base =
            ingredientDB[item.name]?.pieceWeight ??
            ingredientDB[item.name].weight;
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
          disabled={!ingredientDB[item.name]?.pieceWeight}
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
            const base =
              ingredientDB[item.name]?.pieceWeight ??
              ingredientDB[item.name].weight;
            updateIngredientWeight(idx, base);
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
      <div style={{ background: "#2c2c2c", color: "white", padding: 20, borderRadius: 8, width: 500 }}>
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
                  Object.keys(ingredientDB).filter(name =>
                    name.toLowerCase().includes(term.toLowerCase())
                  )
                );
              }}
              placeholder="예) 양파, 두부…"
              style={{ padding: "8px", borderRadius: 4, border: "1px solid #555" }}
            />
            {ingredientSuggestions.length > 0 && (
              <ul style={{
                position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 150, overflowY: "auto",
                background: "#2c2c2c", border: "1px solid #555", borderRadius: "0 0 4px 4px",
                margin: 0, padding: 0, listStyle: "none", zIndex: 10
              }}>
                {ingredientSuggestions.map(name => (
                  <li
                    key={name}
                    onClick={() => {
                      const info = ingredientDB[name]!;
                      setIngredientForm(f => ({
                        ...f,
                        name,
                        weight: info.weight,
                        calories: info.calories,
                        carbs: info.carbs,
                        protein: info.protein,
                        fat: info.fat,
                        avgShelfLife: info.avgShelfLife ?? 0,
                        pieceWeight: info.pieceWeight ?? 0,
                        expirationDate: (() => {
                          const exp = new Date(f.addedDate);
                          exp.setDate(exp.getDate() + (info.avgShelfLife ?? 0));
                          return exp;
                        })()
                      }));
                      setIngredientSearch("");
                      setIngredientSuggestions([]);
                    }}
                    style={{ padding: "6px 8px", cursor: "pointer" }}
                  >
                    {name}
                  </li>
                ))}
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
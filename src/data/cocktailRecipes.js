import { supabase } from '../lib/supabase';

export const fetchCocktailRecipes = async () => {
  const { data, error } = await supabase
    .from('cocktail_recipes')
    .select('*')
    .eq('actif', true)
    .order('nom');
  if (error) throw error;
  return data;
};

export const createCocktailRecipe = async (fields) => {
  const { data, error } = await supabase
    .from('cocktail_recipes')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCocktailRecipe = async (id, fields) => {
  const { data, error } = await supabase
    .from('cocktail_recipes')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

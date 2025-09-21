import json
from django.utils import timezone

CONFIG = {
    "factors": {
        "EF_ELECTRICITY": {"Yes": 0.05, "Partially": 0.25, "No": 0.475},
        "EF_HEATING": {
            "Natural Gas": 0.2, "Electricity": 0.45, "Oil": 0.27,
            "Propane": 0.24, "Wood": 0.015, "Other": 0.3
        },
        "EF_VEHICLE_PER_KM": {
            "Gasoline": 0.18, "Diesel": 0.17, "Hybrid": 0.12, "Electric": 0.05
        },
        "EF_FLIGHT": {"Short-haul (<3h)": 1100, "Medium-haul (3-6h)": 3000, "Long-haul (>6h)": 8000},
        "EF_FLIGHT_PER_KM": 0.15,
        "EF_DIET": {
            "Vegan": 1600 / 12, "Vegetarian": 1900 / 12, "Pescatarian": 2100 / 12,
            "Omnivore": 2500 / 12, "High Meat": 3300 / 12
        },
        "EF_PUBLIC_TRANSPORT_PER_KM": 0.1,
        "EF_WASTE_LANDFILL": 0.45,
        "EF_WATER_PER_LITRE": 0.0005
    },
    "multipliers": {
        "FOOD_WASTE": {"Very little": 0.9, "Below average": 1.0, "Average": 1.2, "Above average": 1.5},
        "FOOD_PACKAGING": {"Very little": 0.9, "Below average": 1.0, "Average": 1.3, "Above average": 1.6},
        "SHOPPING": {"Rarely": 50, "Sometimes": 100, "Often": 200}
    },
    "constants": {
        "HOUSEHOLD_SIZE_DEFAULT": 1,
        "WEEKS_PER_MONTH": 4.33,
        "MONTHS_PER_YEAR": 12,
        "DAYS_PER_MONTH": 30,
        "WASTE_PER_PERSON_PER_DAY_KG": 1.2,
        "RECYCLING_DIVERSION_PER_ITEM": 0.05,
        "COMPOST_DIVERSION": 0.15,
        "OFFSET_PERCENTAGE": 0.10
    }
}


def _get_numeric_input(data: dict, key: str, default: float = 0.0) -> float:
    """Safely retrieves and converts a numeric value from the input data."""
    try:
        return float(data.get(key, default))
    except (ValueError, TypeError):
        return float(default)


def _calculate_household_energy(data: dict) -> float:
    """Calculates TOTAL emissions for the household from electricity and heating."""
    electricity_kwh = _get_numeric_input(data, "how_much_electricity_does_your_household_use_per_month")
    electricity_source = data.get("is_your_electricity_from_renewable_sources", "No")
    ef_electricity = CONFIG["factors"]["EF_ELECTRICITY"].get(electricity_source,
                                                             CONFIG["factors"]["EF_ELECTRICITY"]["No"])
    electricity_emissions = electricity_kwh * ef_electricity

    heating_source = data.get("what_is_your_primary_heating_source", "Natural Gas")
    heating_percent = _get_numeric_input(data,
                                         "what_percentage_of_your_monthly_electricity_consumption_do_you_think_is_used_for_heating")
    heating_kwh_equivalent = electricity_kwh * (heating_percent / 100)
    ef_heating = CONFIG["factors"]["EF_HEATING"].get(heating_source, CONFIG["factors"]["EF_HEATING"]["Natural Gas"])
    heating_emissions = heating_kwh_equivalent * ef_heating

    return electricity_emissions + heating_emissions


def _calculate_personal_transportation(data: dict) -> float:
    """Calculates PERSONAL emissions from vehicles, public transport, and flights."""
    # Private Vehicles (assumes inputs are for the individual's travel)
    vehicle_emissions = 0
    num_vehicles = int(_get_numeric_input(data, "how_many_vehicles_are_in_your_household"))
    for i in range(1, num_vehicles + 1):
        v_type = data.get(f"vehicle_{i}_type", "Gasoline")
        annual_km = _get_numeric_input(data, f"vehicle_{i}_mileage")
        ef = CONFIG["factors"]["EF_VEHICLE_PER_KM"].get(v_type, CONFIG["factors"]["EF_VEHICLE_PER_KM"]["Gasoline"])
        vehicle_emissions += (annual_km * ef) / CONFIG["constants"]["MONTHS_PER_YEAR"]

    # Public Transport
    public_km_per_week = _get_numeric_input(data,
                                            "how_much_distance_do_you_commute_in_public_transport_per_week_on_average")
    public_km_per_month = public_km_per_week * CONFIG["constants"]["WEEKS_PER_MONTH"]
    public_transport_emissions = public_km_per_month * CONFIG["factors"]["EF_PUBLIC_TRANSPORT_PER_KM"]

    # Flights
    flight_emissions = 0
    num_flights = int(_get_numeric_input(data, "how_many_flights_have_you_taken_in_the_past_year"))
    for i in range(1, num_flights + 1):
        flight_type = data.get(f"flight_{i}_type", "Short-haul (<3h)")
        km = CONFIG["factors"]["EF_FLIGHT"].get(flight_type, 2000)
        flight_emissions += (km * CONFIG["factors"]["EF_FLIGHT_PER_KM"]) / CONFIG["constants"]["MONTHS_PER_YEAR"]

    return vehicle_emissions + public_transport_emissions + flight_emissions


def _calculate_personal_diet(data: dict) -> float:
    """Calculates PERSONAL emissions from diet."""
    diet_type = data.get("what_best_describes_your_diet", "Omnivore")
    diet_emissions = CONFIG["factors"]["EF_DIET"].get(diet_type, CONFIG["factors"]["EF_DIET"]["Omnivore"])

    waste_level = data.get("how_much_food_do_you_waste", "Average")
    packaging_level = data.get("how_much_of_your_food_is_packaged_processed", "Average")
    food_multiplier = (CONFIG["multipliers"]["FOOD_WASTE"].get(waste_level, 1.2) *
                       CONFIG["multipliers"]["FOOD_PACKAGING"].get(packaging_level, 1.3))

    return diet_emissions * food_multiplier


def _calculate_household_waste(data: dict, household_size: int) -> float:
    """Calculates TOTAL emissions for the household from landfill waste."""
    total_waste = (CONFIG["constants"]["WASTE_PER_PERSON_PER_DAY_KG"] *
                   household_size * CONFIG["constants"]["DAYS_PER_MONTH"])

    diversion_rate = 0
    for mat in ["glass", "metal", "plastic", "paper"]:
        if data.get(f"do_you_recycle_the_following_check_all_that_apply_{mat}") == "on":
            diversion_rate += CONFIG["constants"]["RECYCLING_DIVERSION_PER_ITEM"]
    if data.get("do_you_compost_food_waste") in ["Some", "All"]:
        diversion_rate += CONFIG["constants"]["COMPOST_DIVERSION"]

    landfill_waste = total_waste * (1 - diversion_rate)
    return landfill_waste * CONFIG["factors"]["EF_WASTE_LANDFILL"]


def _calculate_personal_consumption(data: dict) -> float:
    """Calculates PERSONAL emissions from general consumption (shopping)."""
    shopping_freq = data.get("how_often_do_you_buy_new_clothes_electronics_or_appliances", "Sometimes")
    return CONFIG["multipliers"]["SHOPPING"].get(shopping_freq, 100)


def _calculate_household_water(data: dict) -> float:
    """Calculates TOTAL emissions for the household from water usage."""
    total_water_litres = _get_numeric_input(data, "how_much_water_does_your_household_use_per_month_in_litres")
    return total_water_litres * CONFIG["factors"]["EF_WATER_PER_LITRE"]


# --- Main Function ---

def calculate_personal_carbon_footprint(data: dict) -> dict:
    """
    Calculates a monthly carbon footprint for one person, accounting for shared household emissions.
    """
    household_size = int(_get_numeric_input(data, "how_many_people_are_in_your_household",
                                            CONFIG["constants"]["HOUSEHOLD_SIZE_DEFAULT"]))
    # Ensure household_size is at least 1 to prevent division by zero
    household_size = max(1, household_size)

    # 1. Calculate total household emissions for shared categories
    household_energy_emissions = _calculate_household_energy(data)
    household_waste_emissions = _calculate_household_waste(data, household_size)
    household_water_emissions = _calculate_household_water(data)

    # 2. Calculate personal emissions for individual categories
    personal_transport_emissions = _calculate_personal_transportation(data)
    personal_diet_emissions = _calculate_personal_diet(data)
    personal_consumption_emissions = _calculate_personal_consumption(data)

    # 3. Create the final breakdown, assigning a personal share of household emissions
    breakdown = {
        "home_energy": household_energy_emissions / household_size,
        "transportation": personal_transport_emissions,
        "diet": personal_diet_emissions,
        "waste": household_waste_emissions / household_size,
        "consumption": personal_consumption_emissions,
        "water": household_water_emissions / household_size,
    }

    # 4. Sum up and apply offsets
    total_emissions_before_offset = sum(breakdown.values())
    offset_percent = CONFIG["constants"]["OFFSET_PERCENTAGE"] if data.get(
        "do_you_offset_your_carbon_emissions") == "Yes" else 0
    total_emissions_after_offset = total_emissions_before_offset * (1 - offset_percent)

    # 5. Format the final output
    if total_emissions_before_offset == 0:
        percent_breakdown = {k: "0.0%" for k in breakdown}
    else:
        percent_breakdown = {
            k: f"{(v / total_emissions_before_offset * 100):.1f}%" for k, v in breakdown.items()
        }

    return {
        "summary": {
            "personal_monthly_co2e_kg": round(total_emissions_after_offset, 2),
            "offsets_applied": offset_percent > 0,
            "household_size_used": household_size
        },
        "breakdown_kg_co2e": {k: round(v, 2) for k, v in breakdown.items()},
        "category_percentages": percent_breakdown
    }


daily_survey_data = {
    # Transport choices for the day
    "transport_mode": "Bicycle",  # Options: "Bicycle", "Walk", "Public Transport", "Personal Vehicle", "Worked from Home"
    "transport_distance_km": 10,

    # Main meal choices for the day
    "main_meal_type": "Vegetarian",  # Options from your CONFIG: "Vegan", "Vegetarian", "Pescatarian", "Omnivore", "High Meat"

    # Consumption choices for the day
    "purchased_new_item": "No",  # Options: "Yes", "No"
    "new_item_category": None,     # Options if "Yes": "Electronics", "Clothing", "Home Goods", "Other"

    # Waste choices for the day
    "extra_recycling_composting": "Yes", # Options: "Yes", "No"
    "used_reusable_containers": "Yes" # Options: "Yes", "No"
}


def calculate_sustainability_score(baseline_data: dict, daily_survey: dict) -> dict:
    """
    Calculates a daily sustainability score (0-100) based on daily actions
    compared to a user's baseline carbon footprint.

    The score starts at a baseline and is adjusted based on daily survey
    responses. A higher score indicates more sustainable choices for the day.
    """
    # --- Scoring Configuration ---
    SCORE_CONFIG = {
        "base_score": 50,
        "max_score": 100,
        "min_score": 0,
        "points": {
            "transport": {
                "Bicycle": 15,
                "Walk": 15,
                "Worked from Home": 10,
                "Public Transport": 5,
                "Personal Vehicle": -15
            },
            "diet": {
                # Points awarded relative to an 'Omnivore' diet
                "Vegan": 15,
                "Vegetarian": 10,
                "Pescatarian": 5,
                "Omnivore": 0,
                "High Meat": -10
            },
            "consumption": {
                "purchased_new_item_no": 10,
                "purchased_new_item_yes": -15
            },
            "waste": {
                "extra_recycling_composting_yes": 5,
                "used_reusable_containers_yes": 5
            }
        }
    }

    current_score = SCORE_CONFIG["base_score"]
    feedback = []

    # 1. Score Transportation
    daily_transport_mode = daily_survey.get("transport_mode", "Personal Vehicle")
    transport_points = SCORE_CONFIG["points"]["transport"].get(daily_transport_mode, 0)
    current_score += transport_points
    if transport_points > 5:
        feedback.append(f"Great job using sustainable transport: {daily_transport_mode}!")
    elif transport_points < 0:
        feedback.append("Consider more sustainable transport options when possible.")


    # 2. Score Diet
    baseline_diet = baseline_data.get("what_best_describes_your_diet", "Omnivore")
    daily_diet = daily_survey.get("main_meal_type", baseline_diet)

    baseline_diet_points = SCORE_CONFIG["points"]["diet"].get(baseline_diet, 0)
    daily_diet_points = SCORE_CONFIG["points"]["diet"].get(daily_diet, 0)

    diet_points_change = daily_diet_points - baseline_diet_points
    current_score += diet_points_change

    if diet_points_change > 0:
        feedback.append(f"Choosing a {daily_diet} meal made a positive impact today!")
    elif diet_points_change < 0:
        feedback.append(f"A meal with a lower carbon footprint than {daily_diet} could boost your score.")


    # 3. Score Consumption
    if daily_survey.get("purchased_new_item") == "No":
        current_score += SCORE_CONFIG["points"]["consumption"]["purchased_new_item_no"]
        feedback.append("Avoiding new purchases is a powerful way to reduce your footprint. Well done!")
    else:
        current_score += SCORE_CONFIG["points"]["consumption"]["purchased_new_item_yes"]
        feedback.append("Mindful consumption is key. Consider secondhand options for future purchases.")

    # 4. Score Waste
    if daily_survey.get("extra_recycling_composting") == "Yes":
        current_score += SCORE_CONFIG["points"]["waste"]["extra_recycling_composting_yes"]
        feedback.append("Diverting waste from landfill by recycling and composting is fantastic.")

    if daily_survey.get("used_reusable_containers") == "Yes":
        current_score += SCORE_CONFIG["points"]["waste"]["used_reusable_containers_yes"]
        feedback.append("Using reusable containers is a great way to reduce single-use plastic.")

    # Ensure score is within bounds
    final_score = max(SCORE_CONFIG["min_score"], min(SCORE_CONFIG["max_score"], current_score))

    return {
        "daily_sustainability_score": round(final_score),
        "feedback_for_the_day": feedback
    }

# --- Existing User Data (from your first code block) ---
user_baseline_data = {
  "how_many_people_are_in_your_household": 2,
  "how_much_electricity_does_your_household_use_per_month": 500,
  "is_your_electricity_from_renewable_sources": "Partially",
  "what_is_your_primary_heating_source": "Natural Gas",
  "what_percentage_of_your_monthly_electricity_consumption_do_you_think_is_used_for_heating": 20,
  "how_many_vehicles_are_in_your_household": 1,
  "vehicle_1_type": "Gasoline",
  "vehicle_1_mileage": 15000,
  "how_much_distance_do_you_commute_in_public_transport_per_week_on_average": 50,
  "how_many_flights_have_you_taken_in_the_past_year": 2,
  "flight_1_type": "Short-haul (<3h)",
  "flight_2_type": "Medium-haul (3-6h)",
  "what_best_describes_your_diet": "Omnivore",
  "how_much_food_do_you_waste": "Average",
  "how_much_of_your_food_is_packaged_processed": "Average",
  "do_you_recycle_the_following_check_all_that_apply_glass": "on",
  "do_you_recycle_the_following_check_all_that_apply_plastic": "on",
  "do_you_compost_food_waste": "Some",
  "how_often_do_you_buy_new_clothes_electronics_or_appliances": "Sometimes",
  "how_much_water_does_your_household_use_per_month_in_litres": 3000,
  "do_you_offset_your_carbon_emissions": "No"
}

# --- Daily Survey Input ---
daily_survey = {
    "transport_mode": "Bicycle",
    "transport_distance_km": 10,
    "main_meal_type": "Vegetarian",
    "purchased_new_item": "No",
    "extra_recycling_composting": "Yes",
    "used_reusable_containers": "Yes"
}

# --- Calculate the Scores ---
carbon_footprint = calculate_personal_carbon_footprint(user_baseline_data)
sustainability_score = calculate_sustainability_score(user_baseline_data, daily_survey)


INITIAL_SCORE_CONFIG = {
    # Home & Energy
    "what_type_of_home_do_you_live_in": {"Apartment": 10, "Semi-detached House": 5, "Detached House": 0, "Other": 5},
    "what_is_the_size_of_your_home": {"Small": 10, "Medium": 5, "Large": 0},
    "is_your_electricity_from_renewable_sources": {"Yes": 20, "Partially": 10, "No": 0},
    "do_you_use_energy_saving_appliances_or_lightbulbs": {"Yes": 10, "No": 0},
    # Transportation
    "how_often_do_you_use_public_transport": {"Daily": 10, "Weekly": 5, "Rarely": 0, "Never": -5},
    # Diet
    "what_best_describes_your_diet": {"Vegan": 20, "Vegetarian": 15, "Pescatarian": 10, "Omnivore": 5, "High Meat": 0},
    "how_much_of_your_food_is_organic_local": {"All": 10, "Most": 7, "Some": 3, "None": 0},
    "how_much_food_do_you_waste": {"Very little": 15, "Below average": 10, "Average": 5, "Above average": 0},
    "how_much_of_your_food_is_packaged_processed": {"Very little": 10, "Below average": 7, "Average": 3, "Above average": 0},
    # Waste
    "do_you_compost_food_waste": {"All": 10, "Some": 5, "None": 0},
    "recycling_items_count": {0: 0, 1: 3, 2: 6, 3: 9, 4: 12}, # Points based on how many materials are recycled
    # Consumption
    "how_often_do_you_buy_new_clothes_electronics_or_appliances": {"Rarely": 15, "Sometimes": 5, "Often": 0},
    "do_you_buy_second_hand_or_repair_items": {"Yes": 10, "Sometimes": 5, "Rarely": 2, "No": 0},
    # Water
    "do_you_use_water_saving_devices": {"Yes": 10, "No": 0},
    # Offsetting
    "do_you_offset_your_carbon_emissions": {"Yes": 5, "No": 0}
}

# --- Benchmarks for Normalizing the Score ---
# These values represent a rough estimate of the total points for a
# "low impact" and "high impact" lifestyle based on the points above.
# This helps map the raw point score to a more intuitive 0-100 scale.
MAX_POSSIBLE_POINTS = 162 # Sum of the best options
MIN_POSSIBLE_POINTS = -5   # Sum of the worst options

def calculate_initial_sustainability_score(survey_data: dict) -> dict:
    """
    Calculates an initial sustainability score (0-100) for a new user
    based on their detailed onboarding survey data.

    Args:
        survey_data: A dictionary of the user's answers to the survey.

    Returns:
        A dictionary containing the initial score and a summary.
    """
    total_points = 0
    feedback = []

    # Iterate through the scoring configuration and add points
    for key, point_mapping in INITIAL_SCORE_CONFIG.items():
        user_answer = survey_data.get(key)

        if user_answer is not None:
            # Handle special case for recycling checkboxes
            if key == "recycling_items_count":
                recycled_count = 0
                for mat in ["paper", "glass", "metal", "plastic"]:
                    if survey_data.get(f"do_you_recycle_the_following_check_all_that_apply_{mat}") == "on":
                        recycled_count += 1
                points = point_mapping.get(recycled_count, 0)
                if points > 8:
                    feedback.append("You're doing a great job with recycling!")
                elif points < 4:
                    feedback.append("Tip: Recycling more materials like paper, glass, and metal can boost your score.")

            else:
                points = point_mapping.get(user_answer, 0)
                # Provide feedback for high-impact areas
                if key == "what_best_describes_your_diet" and points < 10:
                    feedback.append("Consider reducing meat consumption for one of the biggest impacts on your footprint.")
                if key == "is_your_electricity_from_renewable_sources" and points == 0:
                    feedback.append("If possible in your area, switching to a green energy provider can make a huge difference.")

            total_points += points

    # Normalize the score to be between 0 and 100
    # Formula: ((total_points - min_points) / (max_points - min_points)) * 100
    score_range = MAX_POSSIBLE_POINTS - MIN_POSSIBLE_POINTS
    normalized_score = ((total_points - MIN_POSSIBLE_POINTS) / score_range) * 100

    # Ensure the score is within the 0-100 bounds
    final_score = max(0, min(100, normalized_score))

    return {
        "initial_sustainability_score": round(final_score),
        "summary": {
            "total_points_achieved": total_points,
            "interpretation": "This score is your sustainability baseline. It reflects your long-term habits. Use the daily tracker to see how small changes can improve it over time!"
        },
        "initial_feedback": feedback
    }



def check_achievements(user):
    now_aware = timezone.now()

    if user.date_joined.tzinfo is None:
        user.date_joined = timezone.make_aware(user.date_joined, timezone.get_current_timezone())

    if user.last_checkin.tzinfo is None:
        user.last_checkin = timezone.make_aware(user.last_checkin, timezone.get_current_timezone())

    achievements = []
    if user.last_checkin > user.date_joined:
        achievements.append(1)

    if user.streak >= 3:
        achievements.append(2)

    if user.streak >= 7:
        achievements.append(3)

    if user.streak >= 30:
        achievements.append(4)

    if user.streak >= 50:
        achievements.append(5)

    if user.streak >= 100:
        achievements.append(6)

    if user.habits_today >= 5:
        achievements.append(7)

    if user.sustainability_score >= 80:
        achievements.append(8)

    if user.sustainability_score == 100:
        achievements.append(9)
    return achievements


import pandas as pd
from analyzer import DataAnalyzer
from insights import InsightEngine
from cleaner import DataCleaner

df = pd.DataFrame({
    'mixed': [1.0, 2.0, 'x', 4.0, 'y'],
    'nums': [1, 2, 3, 4, 5],
    'strs': ['a', 'b', 'c', 'd', 'e']
})
print('types', df.dtypes.to_dict())
print('summary', DataAnalyzer(df).summary_metrics())
print('columns', [c['name'] for c in DataAnalyzer(df).column_analysis()])
print('outliers', DataAnalyzer(df).outlier_summary())
print('viz', DataAnalyzer(df).visualization_data())
print('quality', DataAnalyzer(df).quality_score())
print('insights', InsightEngine(df).generate_insights()['observations'])
print('cleaned', DataCleaner(df).apply_cleaning({'handle_outliers': 'cap', 'outlier_method': 'iqr'})[0].head())

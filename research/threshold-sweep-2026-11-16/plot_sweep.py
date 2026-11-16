"""Render publication figures from the sweep output; requires matplotlib."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
from matplotlib.patches import Patch

ROOT=Path(__file__).resolve().parent
d=json.loads((ROOT/'explorer-data.json').read_text())
keys=['S','A','C','S=A','S=C','A=C','S=A=C','NONE']
colors=['#db8739','#24aaa0','#4788dc','#b0c74a','#be82ca','#75c8df','#ece4b8','#364252']
n=len(d['factors'])
def winner(s,a,c):
    values=[d['first'][m][j] for m,j in zip('SAC',[s,a,c])]
    finite=[v for v in values if v is not None]
    if not finite:return 'NONE'
    return '='.join(m for m,v in zip('SAC',values) if v==min(finite))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10})
fig,axes=plt.subplots(1,3,figsize=(13,6.5))
fig.patch.set_facecolor('#f8fafc')
fig.suptitle('Millie-01 | where threshold rankings flip',fontsize=22,fontweight='bold',x=.06,ha='left',y=.97,color='#132a42')
fig.text(.06,.885,'50,653 combinations · traction loss at 0.50 s · earliest confirmed alert wins',color='#526779',fontsize=12)
for ax,factor in zip(axes,[.25,1.,4.]):
    c=d['factors'].index(factor)
    grid=[[keys.index(winner(s,a,c)) for s in range(n)] for a in range(n)]
    ax.imshow(grid,origin='lower',interpolation='none',cmap=ListedColormap(colors),norm=BoundaryNorm([i-.5 for i in range(9)],8),aspect='equal')
    ticks=list(range(0,n,4))
    ax.set_xticks(ticks,[f'{d["factors"][i]:g}' for i in ticks],rotation=45)
    ax.set_yticks(ticks,[f'{d["factors"][i]:g}' for i in ticks])
    ax.set_title(f'CUSUM threshold = {factor:g}× default',pad=11,fontweight='bold')
    ax.set_xlabel('Signed EWMA threshold × default')
    ax.plot([16],[16],marker='s',markersize=8,markerfacecolor='none',markeredgecolor='white',markeredgewidth=1.8)
axes[0].set_ylabel('Absolute EWMA threshold × default')
fig.legend(handles=[Patch(color=color,label=key) for key,color in zip(keys,colors)],loc='lower center',bbox_to_anchor=(.5,.075),ncol=8,frameon=False,title='S: signed EWMA (EFMW label)    A: absolute EWMA    C: CUSUM    =: tie    NONE: no alert')
fig.text(.06,.025,'Thresholds are not matched for false-alarm rate. Grid counts are parameter sensitivity, not detector win probabilities.',fontsize=10,color='#526779')
fig.subplots_adjust(left=.07,right=.98,top=.8,bottom=.29,wspace=.27)
fig.savefig(ROOT/'ranking-grid.png',dpi=170,facecolor=fig.get_facecolor())
fig.savefig(ROOT/'ranking-grid.svg',facecolor=fig.get_facecolor())
plt.close(fig)

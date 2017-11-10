package org.apache.cordova.plugin;

import java.util.List;

import android.content.Context;
import android.content.res.Resources;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.ImageView;
import android.widget.TextView;

public class FileArrayAdapter extends ArrayAdapter<Option> {

	private Context c;
	private int id;
	private List<Option> items;

	private Resources resources;
	private String packageName;

	public FileArrayAdapter(Context context, int textViewResourceId,
							List<Option> objects) {
		super(context, textViewResourceId, objects);
		c = context;
		id = textViewResourceId;
		items = objects;

		this.packageName = context.getApplicationContext().getPackageName();
		this.resources = context.getApplicationContext().getResources();
	}

	private int getIdentifier(final String name, final String type) {
		return resources.getIdentifier(name, type, this.packageName);
	}

	private int getDrawable(final String name) {
		return getIdentifier(name, "drawable");
	}

	public Option getItem(int i) {
		return items.get(i);
	}
	
	public String getImageName(final Option o) {
		if(o.getData().equalsIgnoreCase("folder")){
			return "folder";
		} 
		
		if (o.getData().equalsIgnoreCase("parent directory")) {
			return "back32";
		} 
		
		final String name = o.getName().toLowerCase();
		if (name.endsWith(".xls") ||  name.endsWith(".xlsx"))
			return "xls";
		if (name.endsWith(".doc") ||  name.endsWith(".docx"))
			return "doc";
		if (name.endsWith(".ppt") ||  name.endsWith(".pptx"))
			return "ppt";
		if (name.endsWith(".pdf"))
			return "pdf";
		if (name.endsWith(".apk"))
			return "android32";
		if (name.endsWith(".txt"))
			return "txt32";
		if (name.endsWith(".jpg") || name.endsWith(".jpeg"))
			return "jpg32";
		if (name.endsWith(".png"))
			return "png32";
		if (name.endsWith(".zip"))
			return "zip32";
		if (name.endsWith(".rtf"))
			return "rtf32";
		if (name.endsWith(".gif"))
			return "gif32";
	
		return "whitepage32";
	}

	@Override
	public View getView(int position, View convertView, ViewGroup parent) {
		View v = convertView;
		if (v == null) {
			final LayoutInflater vi = (LayoutInflater) c
					.getSystemService(Context.LAYOUT_INFLATER_SERVICE);
			v = vi.inflate(id, null);
		}
		final Option o = items.get(position);
		if (o == null) {
			return v;
		}
		
		final ImageView im = (ImageView) v.findViewById(getIdentifier("img1", "id"));
		final TextView t1 = (TextView) v.findViewById(getIdentifier("TextView01", "id"));
		final TextView t2 = (TextView) v.findViewById(getIdentifier("TextView02", "id"));
		
		final String imageName = getImageName(o);
		
		im.setImageResource(getDrawable(imageName));
		
		if (t1 != null) {
			t1.setText(o.getName());
		}
		if (t2 != null) {
			t2.setText(o.getData());
		}

		return v;
	}

}
